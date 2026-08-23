import { useMutation } from "@tanstack/react-query";
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
  fontSize: number;
  fontStep: number;
  cycleFont: () => void;
}

export function useAiChatSession(clanId: string | undefined): AiChatSession {
  const confirm = useConfirm();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  const ask = useMutation({
    mutationFn: (question: string) =>
      askAssistant({ clanId: clanId!, question, history: turns }),
    onSuccess: (res) =>
      setTurns((t) => [...t, { role: "assistant", content: res.answer }]),
    onError: (e: Error) => setError(e.message),
  });

  const { mutate } = ask;
  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || !clanId || ask.isPending) return;
      setError(null);
      setDraft("");
      setTurns((t) => [...t, { role: "user", content: q }]);
      track("ai_message_sent");
      mutate(q);
    },
    [clanId, ask.isPending, mutate],
  );

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
    fontSize: FONT_STEPS[fontStep],
    fontStep,
    cycleFont,
  };
}
