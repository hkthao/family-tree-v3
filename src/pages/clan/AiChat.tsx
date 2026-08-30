import { useEffect, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ChatComposer } from "@/components/ai/ChatComposer";
import { ProposalCard } from "@/components/ai/ProposalCard";
import { QuotaBadge } from "@/components/ai/QuotaBadge";
import { ChatThread } from "@/components/ai/ChatThread";
import { IconArrowLeft, IconSparkles, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAiChatSession } from "@/hooks/useAiChatSession";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { track } from "@/lib/analytics";
import { isFeatureEnabled } from "@/lib/clanFeatures";

/**
 * Trang trợ lý hỏi đáp gia phả — GĐ 1, chỉ đọc.
 *
 * **Hai khung, không phải một khung co giãn:**
 *
 *  - *Điện thoại* — lớp phủ toàn màn (`fixed inset-0`). Phải che cả
 *    BottomTabBar, vì nav 56px cộng safe-area sẽ ăn mất chỗ ô nhập.
 *  - *Máy tính* — thẻ nằm trong layout, rộng tối đa `max-w-3xl`. Trước đây
 *    máy tính cũng dùng lớp phủ toàn màn: trên màn 1900px nó thành một
 *    khoảng đen mênh mông, nút bấm dạt ra tận hai mép, đọc rất mệt. Ngoài
 *    ra người dùng máy tính thường muốn **vừa xem gia phả vừa hỏi** —
 *    việc đó do khung nổi `AiChatDock` lo.
 *
 * Ba chỗ dễ vỡ đã xử lý (đều thuộc phía điện thoại):
 *  1. Bàn phím iOS — dùng `useVisualViewport`, KHÔNG dùng `100dvh`
 *     (dvh chỉ co theo thanh URL, không theo bàn phím).
 *  2. Auto-scroll đánh nhau với người đang đọc lại — xem `ChatThread`.
 *  3. Chữ nhỏ — app chặn pinch-zoom toàn cục (`user-scalable=no`), nên
 *     phải có nút chỉnh cỡ chữ ngay tại đây.
 *
 * Đã có: giọng nói (GĐ 2, trong ChatComposer), hạn mức (GĐ 3, QuotaBadge),
 * bóc tách thêm người (GĐ 5, ProposalCard). Chưa có: thanh toán (GĐ 4).
 */
export default function AiChat() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const vp = useVisualViewport();

  usePageTitle("Trợ lý dòng họ");

  const chat = useAiChatSession(clanId);

  // Cần CẢ công tắc tổng lẫn cờ theo dòng họ — xem isAiEnabled().
  const aiEnabled = useAiEnabled();
  const enabled =
    aiEnabled && isFeatureEnabled(clan.disabled_features, "ai_assistant");

  useEffect(() => {
    track("ai_chat_opened");
  }, []);

  // Chiều cao thật, đã trừ bàn phím. Không dùng 100dvh — xem đầu file.
  const shellHeight = useMemo(
    () => (vp.height ? `${vp.height}px` : "100dvh"),
    [vp.height],
  );

  if (!clanId) return <Navigate to="/clans" replace />;
  if (!enabled) return <Navigate to={`/clans/${clanId}`} replace />;

  const header = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">Trợ lý dòng họ</p>
        <p className="truncate text-xs text-muted-foreground">
          {clan.name}
        </p>
      </div>
      <QuotaBadge quota={chat.quota} className="text-xs" />
      {/* icon-audit: ok — chữ "A" chính là ký hiệu, thêm icon nữa là thừa */}
      <Button
        variant="ghost"
        size="icon"
        onClick={chat.cycleFont}
        aria-label="Đổi cỡ chữ"
        title="Đổi cỡ chữ"
        className="h-11 w-11 text-base font-semibold"
      >
        A{chat.fontStep > 0 ? "+" : ""}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={chat.clearHistory}
        aria-label="Xoá lịch sử trò chuyện"
        title="Xoá lịch sử trò chuyện"
        disabled={!chat.turns.length}
        className="h-11 w-11"
      >
        <IconTrash className="h-5 w-5" />
      </Button>
    </>
  );

  const body = (
    <>
      <ChatThread
        turns={chat.turns}
        pending={chat.pending}
        streamingText={chat.streamingText}
        error={chat.error}
        fontSize={chat.fontSize}
        clanName={clan.name}
        canAddPeople={canEditClan(clan)}
        quotaFallbackHref={
          chat.quotaExhausted ? `/clans/${clanId}/ai-generate` : undefined
        }
        proposalCard={
          chat.proposal ? (
            <ProposalCard
              proposal={chat.proposal}
              applying={chat.applying}
              onConfirm={chat.confirmProposal}
              onEdit={chat.editProposal}
              onReject={chat.rejectProposal}
              fontSize={chat.fontSize}
            />
          ) : undefined
        }
      />
      <ChatComposer
        draft={chat.draft}
        onDraftChange={chat.setDraft}
        onSend={chat.send}
        pending={chat.pending}
        showSuggestions={!vp.keyboardOpen && !chat.turns.length}
      />
    </>
  );

  // ─── Máy tính: thẻ trong layout ────────────────────────────────────
  // Trừ đi header dính (64px) + padding của <main> (24px trên/dưới) và
  // chừa một chút thở ở đáy.
  if (isDesktop) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <IconSparkles className="h-5 w-5 shrink-0 text-primary" />
          {header}
        </header>
        {body}
      </div>
    );
  }

  // ─── Điện thoại: lớp phủ toàn màn ──────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col bg-background"
      style={{ height: shellHeight, top: vp.offsetTop || 0 }}
    >
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
        {header}
      </header>
      {body}
    </div>
  );
}
