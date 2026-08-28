import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { IconPlay, IconSparkles } from "@/components/icons";
import type { ChatTurn } from "@/lib/queries/aiChat";
import { cn } from "@/lib/utils";

/**
 * Luồng tin nhắn — dùng chung cho trang toàn màn hình (điện thoại) và
 * khung nổi (máy tính).
 *
 * Quy tắc cuộn: **chỉ tự kéo xuống khi người dùng đang ở gần đáy.** Ai
 * đang đọc lại đoạn cũ mà bị giật xuống đáy là mất chỗ đọc; thay vào đó
 * hiện nút "Tin mới" để họ tự quyết.
 */

/** Coi là "đang ở đáy" nếu cách đáy dưới ngần này px. */
const NEAR_BOTTOM_PX = 80;

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

export function ChatThread({
  turns,
  pending,
  error,
  fontSize,
  clanName,
  proposalCard,
  className,
}: {
  turns: ChatTurn[];
  pending: boolean;
  error: string | null;
  fontSize: number;
  clanName: string;
  /** Thẻ xác nhận thêm người, nếu đang có đề xuất chờ (GĐ 5). */
  proposalCard?: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = true;
    setShowJump(false);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < NEAR_BOTTOM_PX;
    if (atBottomRef.current) setShowJump(false);
  }, []);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
    else setShowJump(true);
  }, [turns, pending, proposalCard, scrollToBottom]);

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain px-3 py-4"
        style={{ fontSize }}
      >
        {!turns.length && (
          <div className="mx-auto max-w-md px-2 py-6 text-center">
            <IconSparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="mb-2 font-semibold">Chào bạn 👋</p>
            <p className="text-muted-foreground">
              Tôi biết về gia phả dòng họ {clanName}. Bạn cứ hỏi bằng lời
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

          {proposalCard && <li className="w-full">{proposalCard}</li>}

          {pending && (
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
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
        >
          ↓ Tin mới
        </button>
      )}
    </div>
  );
}
