import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import * as history from "@/lib/aiChatHistory";
import { track } from "@/lib/analytics";
import {
  askAssistant,
  clearServerHistory,
  loadServerHistory,
  type ChatTurn,
} from "@/lib/queries/aiChat";
import { loadMyQuota, type CreditQuota } from "@/lib/queries/credits";
import { applyProposal, type Proposal } from "@/lib/queries/aiExtract";

/**
 * Toàn bộ trạng thái một phiên trò chuyện với trợ lý.
 *
 * Tách khỏi component vì cùng cuộc trò chuyện được vẽ ở **hai khung khác
 * nhau**: trang toàn màn hình trên điện thoại và khung nổi góc phải trên
 * máy tính. Hai khung đó chỉ khác cái vỏ; logic lịch sử, gửi tin, cỡ chữ
 * thì y hệt nhau và không được phép lệch.
 *
 * Cỡ chữ để ở đây (không để trong khung) vì người lớn tuổi chỉnh một lần
 * là phải nhớ, đổi khung hay đổi máy vẫn giữ.
 */

export const FONT_STEPS = [18, 20, 23] as const;
const FONT_KEY = "family-tree:ai-chat-font";

export interface AiChatSession {
  turns: ChatTurn[];
  draft: string;
  setDraft: (v: string) => void;
  send: (text: string) => void;
  pending: boolean;
  error: string | null;
  clearHistory: () => Promise<void>;
  /** Hạn mức tháng này. `null` = máy chủ chưa bật hạn mức → đừng hiện gì. */
  quota: CreditQuota | null;
  /** Đề xuất thêm người đang chờ người dùng xác nhận (GĐ 5). */
  proposal: Proposal | null;
  /** Đang ghi vào gia phả sau khi bấm "Đúng rồi". */
  applying: boolean;
  confirmProposal: () => void;
  rejectProposal: () => void;
  /** "Sửa lại" — trả câu vừa nói về ô nhập, bóc tách lại KHÔNG mất lượt. */
  editProposal: () => void;
  fontSize: number;
  fontStep: number;
  cycleFont: () => void;
}

export function useAiChatSession(clanId: string | undefined): AiChatSession {
  const confirm = useConfirm();
  const qc = useQueryClient();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<CreditQuota | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // Mã lượt + câu nói gốc của đề xuất đang chờ. Giữ lại để "Sửa lại"
  // gửi lại đúng ref đó — cùng ref thì không bị trừ lượt lần hai.
  const [pending, setPending] = useState<{ ref?: string; question: string } | null>(
    null,
  );
  const [fontStep, setFontStep] = useState(() => {
    const v = Number(localStorage.getItem(FONT_KEY));
    return Number.isInteger(v) && v >= 0 && v < FONT_STEPS.length ? v : 0;
  });

  // ─── Lịch sử: vẽ ngay từ cache, rồi hoà với bản trên server ──────
  // Server là nguồn sự thật (đồng bộ giữa máy tính và điện thoại);
  // localStorage chỉ để không phải nhìn màn hình trống lúc chờ mạng.
  useEffect(() => {
    if (!clanId) return;
    setTurns(history.load(clanId));
    let alive = true;
    loadServerHistory(clanId)
      .then((server) => {
        // Chỉ ghi đè khi server thực sự có dữ liệu — mạng lỗi hoặc dòng họ
        // mới thì giữ nguyên cache, đừng xoá trắng những gì đang hiện.
        if (alive && server.length) setTurns(server);
      })
      .catch(() => {
        /* offline: cứ dùng cache, không báo lỗi làm gì */
      });
    return () => {
      alive = false;
    };
  }, [clanId]);

  useEffect(() => {
    if (clanId) history.save(clanId, turns);
  }, [clanId, turns]);

  // Đọc hạn mức ngay khi mở khung chat — lời gọi này cũng là chỗ cấp lượt
  // free của tháng, nên mở ra là đã có lượt để dùng.
  useEffect(() => {
    let alive = true;
    loadMyQuota()
      .then((q) => alive && setQuota(q))
      .catch(() => {
        /* chưa áp migration: coi như không có hạn mức */
      });
    return () => {
      alive = false;
    };
  }, []);

  const ask = useMutation({
    mutationFn: (input: { question: string; ref?: string }) =>
      askAssistant({
        clanId: clanId!,
        question: input.question,
        history: turns,
        ref: input.ref,
      }),
    onSuccess: (res, input) => {
      setTurns((t) => [...t, { role: "assistant", content: res.answer }]);
      // Hết lượt KHÔNG phải lỗi — máy chủ trả 200 kèm câu nhắn nhẹ và
      // đường lui, nên nó hiện như một câu trả lời bình thường.
      if (res.quotaExhausted) track("ai_quota_exhausted");
      if (typeof res.credits === "number") {
        const left = res.credits;
        setQuota((q) => (q ? { ...q, balance: left } : q));
      }
      // Đề xuất thêm người: giữ ở đây chứ KHÔNG lưu vào lịch sử. Nó là
      // trạng thái của một lần trao đổi; mở lại trên máy khác mà hiện
      // một cái nút "Đúng rồi" của hôm qua là mời người ta bấm nhầm.
      setProposal(res.proposal ?? null);
      setPending(
        res.proposal ? { ref: res.ref, question: input.question } : null,
      );
    },
    onError: (e: Error) => setError(e.message),
  });

  const { mutate } = ask;
  // Ref của lượt đang sửa lại — dùng một lần rồi thôi.
  const [retryRef, setRetryRef] = useState<string | undefined>(undefined);

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || !clanId || ask.isPending) return;
      setError(null);
      setDraft("");
      setTurns((t) => [...t, { role: "user", content: q }]);
      track("ai_message_sent");
      mutate({ question: q, ref: retryRef });
      setRetryRef(undefined);
    },
    [clanId, ask.isPending, mutate, retryRef],
  );

  // ─── Thẻ xác nhận (GĐ 5) ────────────────────────────────────────
  const apply = useMutation({
    mutationFn: () => applyProposal(clanId!, proposal!),
    onSuccess: (res) => {
      track("ai_extract_confirmed");
      setProposal(null);
      setPending(null);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: `Đã thêm ${res.added} người vào gia phả. Bạn mở Danh bạ hoặc Cây để xem nhé.`,
        },
      ]);
      // Cây, danh bạ, thống kê đang giữ bản cũ trong cache — không dọn
      // thì người dùng vừa xác nhận xong lại thấy y như chưa thêm gì.
      qc.invalidateQueries({
        predicate: (query) => {
          const [head, second] = query.queryKey as unknown[];
          if (typeof head !== "string") return false;
          if (head === "person" || head === "person-relationships") return true;
          return (
            second === clanId &&
            ["persons", "tree-data", "clan-stats", "branches", "clan"].includes(
              head,
            )
          );
        },
      });
    },
    onError: (e: Error) => setError(e.message),
  });

  const confirmProposal = useCallback(() => {
    if (proposal && !apply.isPending) apply.mutate();
  }, [apply, proposal]);

  const rejectProposal = useCallback(() => {
    track("ai_extract_rejected");
    setProposal(null);
    setPending(null);
    setTurns((t) => [
      ...t,
      { role: "assistant", content: "Vâng, tôi chưa thêm ai cả." },
    ]);
  }, []);

  const editProposal = useCallback(() => {
    // Trả nguyên câu vừa nói về ô nhập để sửa rồi gửi lại. Kèm ref cũ nên
    // lần bóc tách lại KHÔNG bị trừ lượt (plan §"1 lượt" là gì).
    if (pending) {
      setDraft(pending.question);
      setRetryRef(pending.ref);
    }
    setProposal(null);
    setPending(null);
  }, [pending]);

  const clearHistory = useCallback(async () => {
    const ok = await confirm({
      title: "Xoá lịch sử trò chuyện?",
      description:
        "Các câu đã hỏi sẽ bị xoá. Gia phả của bạn không bị ảnh hưởng.",
      confirmLabel: "Xoá",
      destructive: true,
    });
    if (!ok || !clanId) return;
    history.clear(clanId);
    setTurns([]);
    setError(null);
    // Xoá cả bản trên server, nếu không mở lại là nó hiện về.
    clearServerHistory(clanId).catch((e: Error) => setError(e.message));
  }, [clanId, confirm]);

  const cycleFont = useCallback(() => {
    setFontStep((s) => {
      const next = (s + 1) % FONT_STEPS.length;
      localStorage.setItem(FONT_KEY, String(next));
      return next;
    });
  }, []);

  return {
    turns,
    draft,
    setDraft,
    send,
    pending: ask.isPending,
    error,
    clearHistory,
    quota,
    proposal,
    applying: apply.isPending,
    confirmProposal,
    rejectProposal,
    editProposal,
    fontSize: FONT_STEPS[fontStep],
    fontStep,
    cycleFont,
  };
}
