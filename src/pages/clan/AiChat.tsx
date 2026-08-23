import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { IconArrowLeft, IconPlay, IconSend, IconTrash } from "@/components/icons";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useClanContext } from "@/hooks/useClanContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import * as history from "@/lib/aiChatHistory";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import { track } from "@/lib/analytics";
import { askAssistant, type ChatTurn } from "@/lib/queries/aiChat";

/**
 * Trợ lý hỏi đáp gia phả — GĐ 1, chỉ đọc.
 *
 * Thiết kế mobile-first vì 45/60 phiên tháng 8 là điện thoại, và màn hình
 * thật ghi nhận được nhỏ tới 320×568. Chi tiết quyết định nằm ở
 * docs/plan-ai-tro-ly.md §UI — mobile-first.
 *
 * Ba chỗ dễ vỡ đã xử lý ở đây:
 *  1. Bàn phím iOS — dùng `useVisualViewport`, KHÔNG dùng `100dvh`
 *     (dvh chỉ co theo thanh URL, không theo bàn phím).
 *  2. Auto-scroll đánh nhau với người đang đọc lại — chỉ tự cuộn khi đang
 *     ở gần đáy, còn lại hiện nút "Tin mới".
 *  3. Chữ nhỏ — app đang chặn pinch-zoom toàn cục (`user-scalable=no`),
 *     nên phải có nút chỉnh cỡ chữ ngay tại đây.
 *
 * Chưa có: giọng nói (GĐ 2), hạn mức (GĐ 3), bóc tách nhập liệu (GĐ 5).
 */

const SUGGESTIONS = [
  "Giỗ sắp tới là ngày nào?",
  "Dòng họ có bao nhiêu người?",
  "Ông tổ của dòng họ là ai?",
  "Tôi gọi bác cả là gì?",
];

/** Coi là "đang ở đáy" nếu cách đáy dưới ngần này px. */
const NEAR_BOTTOM_PX = 80;

const FONT_STEPS = [18, 20, 23] as const;
const FONT_KEY = "family-tree:ai-chat-font";

export default function AiChat() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();
  const navigate = useNavigate();
  const confirm = useConfirm();

  usePageTitle("Trợ lý dòng họ");

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [fontStep, setFontStep] = useState(() => {
    const v = Number(localStorage.getItem(FONT_KEY));
    return Number.isInteger(v) && v >= 0 && v < FONT_STEPS.length ? v : 0;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const vp = useVisualViewport();

  const enabled = isFeatureEnabled(clan.disabled_features, "ai_assistant");

  // ─── Nạp lịch sử trên máy ────────────────────────────────────────
  useEffect(() => {
    if (clanId) setTurns(history.load(clanId));
  }, [clanId]);

  useEffect(() => {
    if (clanId) history.save(clanId, turns);
  }, [clanId, turns]);

  useEffect(() => {
    track("ai_chat_opened");
  }, []);

  // ─── Cuộn: chỉ tự kéo khi người dùng đang ở đáy ──────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setShowJump(false);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < NEAR_BOTTOM_PX;
    if (atBottomRef.current) setShowJump(false);
  }, []);

  const ask = useMutation({
    mutationFn: (question: string) =>
      askAssistant({ clanId: clanId!, question, history: turns }),
    onSuccess: (res) => {
      setTurns((t) => [...t, { role: "assistant", content: res.answer }]);
    },
    onError: (e: Error) => setError(e.message),
  });

  // Sau mỗi tin mới: ở đáy thì kéo theo, không thì hiện nút "Tin mới".
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
    else setShowJump(true);
  }, [turns, ask.isPending, scrollToBottom]);

  function send(text: string) {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setError(null);
    setDraft("");
    atBottomRef.current = true;
    setTurns((t) => [...t, { role: "user", content: q }]);
    track("ai_message_sent");
    ask.mutate(q);
  }

  function speak(text: string) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "vi-VN";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch {
      /* trình duyệt không hỗ trợ — nút chỉ đơn giản không làm gì */
    }
  }

  async function clearHistory() {
    const ok = await confirm({
      title: "Xoá lịch sử trò chuyện?",
      description:
        "Các câu đã hỏi sẽ bị xoá khỏi máy này. Gia phả của bạn không bị ảnh hưởng.",
      confirmLabel: "Xoá",
      destructive: true,
    });
    if (!ok || !clanId) return;
    history.clear(clanId);
    setTurns([]);
    setError(null);
  }

  const fontSize = FONT_STEPS[fontStep];
  function cycleFont() {
    const next = (fontStep + 1) % FONT_STEPS.length;
    setFontStep(next);
    localStorage.setItem(FONT_KEY, String(next));
  }

  // Chiều cao thật, đã trừ bàn phím. Không dùng 100dvh — xem đầu file.
  const shellHeight = useMemo(
    () => (vp.height ? `${vp.height}px` : "100dvh"),
    [vp.height],
  );

  if (!clanId) return <Navigate to="/clans" replace />;
  if (!enabled) return <Navigate to={`/clans/${clanId}`} replace />;

  return (
    // fixed inset-0: chiếm trọn màn hình và che BottomTabBar — nav 56px
    // cộng safe-area sẽ ăn mất chỗ ô nhập nếu để chat nằm trong layout.
    <div
      className="fixed inset-0 z-30 flex flex-col bg-background"
      style={{ height: shellHeight, top: vp.offsetTop || 0 }}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-1 border-b px-2 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/clans/${clanId}`)}
          aria-label="Đóng trợ lý"
          className="h-12 w-12"
        >
          <IconArrowLeft className="h-6 w-6" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">Trợ lý dòng họ</p>
          <p className="truncate text-xs text-muted-foreground">{clan.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleFont}
          aria-label="Đổi cỡ chữ"
          title="Đổi cỡ chữ"
          className="h-12 w-12 text-base font-semibold"
        >
          A{fontStep > 0 ? "+" : ""}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearHistory}
          aria-label="Xoá lịch sử trò chuyện"
          disabled={!turns.length}
          className="h-12 w-12"
        >
          <IconTrash className="h-5 w-5" />
        </Button>
      </header>

      {/* ─── Luồng tin ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        style={{ fontSize }}
      >
        {!turns.length && (
          <div className="mx-auto max-w-md py-6 text-center">
            <p className="mb-2 font-semibold">Chào bạn 👋</p>
            <p className="text-muted-foreground" style={{ fontSize }}>
              Tôi biết về gia phả dòng họ {clan.name}. Bạn cứ hỏi bằng lời
              thường ngày — ngày giỗ, cách xưng hô, ai là con ai.
            </p>
          </div>
        )}

        <ul className="mx-auto flex max-w-2xl flex-col gap-3">
          {turns.map((t, i) => (
            <li
              key={i}
              className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  t.role === "user"
                    ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 leading-relaxed text-primary-foreground"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 leading-relaxed"
                }
              >
                {t.content}
                {t.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => speak(t.content)}
                    className="mt-2 flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline"
                  >
                    <IconPlay className="h-4 w-4" />
                    Đọc to
                  </button>
                )}
              </div>
            </li>
          ))}

          {ask.isPending && (
            <li className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-3 text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  Đang nghĩ…
                </span>
              </div>
            </li>
          )}

          {error && (
            <li className="flex justify-start">
              <div
                role="alert"
                className="max-w-[85%] rounded-2xl rounded-bl-sm border border-destructive/40 bg-destructive/10 px-4 py-2.5"
              >
                {error}
              </div>
            </li>
          )}
        </ul>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
        >
          ↓ Tin mới
        </button>
      )}

      {/* ─── Chip gợi ý — ẩn khi bàn phím mở, lúc đó không cần nữa ── */}
      {!vp.keyboardOpen && !turns.length && (
        <div className="shrink-0 overflow-x-auto px-3 pb-2">
          <div className="flex gap-2" style={{ scrollSnapType: "x proximity" }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm hover:bg-secondary"
                style={{ scrollSnapAlign: "start" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Ô nhập ─────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex shrink-0 items-end gap-2 border-t bg-background px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={1}
          placeholder="Hỏi về gia phả…"
          aria-label="Câu hỏi"
          // 18px: dưới 16px là iOS tự phóng to khi focus, mà app đang
          // chặn pinch-zoom nên người dùng không zoom lại được.
          className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border bg-background px-4 py-3 leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontSize: 18 }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || ask.isPending}
          aria-label="Gửi"
          className="h-12 w-12 shrink-0 rounded-full"
        >
          <IconSend className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
