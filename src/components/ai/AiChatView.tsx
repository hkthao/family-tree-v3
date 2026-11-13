import { ChatComposer } from "@/components/ai/ChatComposer";
import { ChatThread } from "@/components/ai/ChatThread";
import { ProposalCard } from "@/components/ai/ProposalCard";
import { QuotaBadge } from "@/components/ai/QuotaBadge";
import { IconSparkles, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAiChatSession } from "@/hooks/useAiChatSession";
import { canEditClan } from "@/hooks/useClanContext";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { ReactNode } from "react";

import { t } from "@lingui/core/macro";
/**
 * Phần ruột của khung trò chuyện, dùng chung cho khung dock bên phải (máy
 * tính) và ngăn kéo toàn màn hình (điện thoại). Phiên chat nằm trong hook
 * `useAiChatSession` nên mỗi nơi dùng một instance — hai nơi không bao giờ mở
 * cùng lúc.
 *
 * `variant="dock"`: tự vẽ header (tên, hạn mức, cỡ chữ, xoá, + `actions` do
 * cha truyền: toàn màn hình / thu nhỏ). `variant="panel"`: SidePanel đã có
 * header nên chỉ còn một thanh công cụ gọn.
 */
export function AiChatView({
  clan,
  variant,
  actions,
}: {
  clan: ClanDetail;
  variant: "dock" | "panel";
  actions?: ReactNode;
}) {
  const chat = useAiChatSession(clan.id);
  const toolButtons = (
    <>
      {/* icon-audit: ok — chữ "A" chính là ký hiệu, thêm icon nữa là thừa */}
      <Button
        variant="ghost"
        size="icon"
        onClick={chat.cycleFont}
        aria-label={t`Đổi cỡ chữ`}
        title={t`Đổi cỡ chữ`}
        className="h-9 w-9 text-sm font-semibold"
      >
        A{chat.fontStep > 0 ? "+" : ""}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={chat.clearHistory}
        aria-label={t`Xoá lịch sử trò chuyện`}
        title={t`Xoá lịch sử trò chuyện`}
        disabled={!chat.turns.length}
        className="h-9 w-9"
      >
        <IconTrash className="h-4 w-4" />
      </Button>
    </>
  );
  const tools = (
    <>
      <QuotaBadge quota={chat.quota} className="text-xs" />
      {toolButtons}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {variant === "dock" ? (
        // Cao 64px + viền dưới + nền như appbar của trang (ClanLayout) để hai thanh thẳng hàng.
        <header className="flex h-[65px] shrink-0 items-center gap-1 border-b bg-background px-3">
          <IconSparkles className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">
              {t`Trợ lý dòng họ`}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{clan.name}</span>
              <QuotaBadge quota={chat.quota} className="shrink-0 text-xs" />
            </div>
          </div>
          {toolButtons}
          {actions}
        </header>
      ) : (
        <div className="flex shrink-0 items-center justify-end gap-1 border-b px-3 py-1.5">
          {tools}
        </div>
      )}

      <ChatThread
        turns={chat.turns}
        pending={chat.pending}
        streamingText={chat.streamingText}
        onRate={chat.rateTurn}
        error={chat.error}
        fontSize={chat.fontSize}
        clanName={clan.name}
        canAddPeople={canEditClan(clan)}
        quotaFallbackHref={
          chat.quotaExhausted ? `/clans/${clan.id}/ai-generate` : undefined
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
        showSuggestions={!chat.turns.length}
        suggestionLayout={variant === "dock" ? "wrap" : undefined}
        micSize={variant === "dock" ? "sm" : undefined}
      />
    </div>
  );
}
