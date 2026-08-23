import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ChatComposer } from "@/components/ai/ChatComposer";
import { ChatThread } from "@/components/ai/ChatThread";
import {
  IconChevronDown,
  IconMaximize,
  IconSparkles,
  IconTrash,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAiChatSession } from "@/hooks/useAiChatSession";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { track } from "@/lib/analytics";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import type { ClanDetail } from "@/lib/queries/clan-detail";

/**
 * Khung chat nổi ở góc phải — kiểu Messenger, chỉ trên máy tính.
 *
 * Vì sao cần, khi đã có trang `/tro-ly`: câu hỏi về gia phả hầu như luôn
 * đi kèm việc **đang xem một thứ gì đó** — đang mở hồ sơ một người thì
 * muốn hỏi "tôi gọi bác này là gì". Bắt rời trang để hỏi rồi quay lại là
 * đứt mạch; hỏi xong quay lại thì mất cả vị trí cuộn.
 *
 * Chỉ hiện từ `lg` trở lên. Điện thoại không có chỗ cho khung nổi —
 * ở đó trang toàn màn hình mới là đúng, và đã có mục trong menu.
 *
 * Khung **không phải modal**: người dùng vẫn bấm được ra ngoài, vẫn cuộn
 * trang được. Đó là toàn bộ mục đích. Nên không focus-trap, không overlay.
 */

const OPEN_KEY = "family-tree:ai-dock-open";

export function AiChatDock({ clan }: { clan: ClanDetail }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const aiEnabled = useAiEnabled();
  const { pathname } = useLocation();

  // Trang trợ lý toàn màn hình đã là chính nó — hai khung cùng lúc thì
  // vừa thừa vừa dễ nhầm cái nào là cái đang nghe.
  const onChatPage = pathname.endsWith("/tro-ly");

  const enabled =
    isDesktop &&
    !onChatPage &&
    aiEnabled &&
    isFeatureEnabled(clan.disabled_features, "ai_assistant");

  if (!enabled) return null;
  return <Dock clan={clan} />;
}

/**
 * Tách riêng để **phiên chat chỉ tồn tại khi khung thực sự dùng được**:
 * hook `useAiChatSession` gọi mạng lấy lịch sử, không nên chạy trên điện
 * thoại hay khi trợ lý đang tắt.
 */
function Dock({ clan }: { clan: ClanDetail }) {
  const navigate = useNavigate();
  const chat = useAiChatSession(clan.id);
  const [open, setOpen] = useState(
    () => localStorage.getItem(OPEN_KEY) === "1",
  );

  const setOpenPersisted = useCallback((next: boolean) => {
    setOpen(next);
    localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  }, []);

  useEffect(() => {
    if (open) track("ai_chat_opened");
  }, [open]);

  // ESC thu khung lại. Chỉ khi tiêu điểm đang ở trong khung, để không
  // cướp phím ESC của dialog hay drawer đang mở ngoài kia.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement;
      if (el?.closest?.("[data-ai-dock]")) setOpenPersisted(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpenPersisted]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenPersisted(true)}
        // Nhô lên trên BottomTabBar (z-30) và header dính, nhưng nằm dưới
        // dialog — hỏi trợ lý giữa lúc đang xác nhận xoá là không nên.
        className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 font-medium text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <IconSparkles className="h-5 w-5" />
        Trợ lý
      </button>
    );
  }

  return (
    <div
      data-ai-dock
      role="complementary"
      aria-label="Trợ lý dòng họ"
      className="fixed bottom-6 right-6 z-40 flex h-[min(34rem,calc(100dvh-8rem))] w-[24rem] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
    >
      <header className="flex shrink-0 items-center gap-1 border-b bg-card px-3 py-2">
        <IconSparkles className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Trợ lý dòng họ</p>
          <p className="truncate text-xs text-muted-foreground">{clan.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={chat.cycleFont}
          aria-label="Đổi cỡ chữ"
          title="Đổi cỡ chữ"
          className="h-9 w-9 text-sm font-semibold"
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
          className="h-9 w-9"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/clans/${clan.id}/tro-ly`)}
          aria-label="Mở toàn màn hình"
          title="Mở toàn màn hình"
          className="h-9 w-9"
        >
          <IconMaximize className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpenPersisted(false)}
          aria-label="Thu nhỏ khung trò chuyện"
          title="Thu nhỏ"
          className="h-9 w-9"
        >
          <IconChevronDown className="h-5 w-5" />
        </Button>
      </header>

      <ChatThread
        turns={chat.turns}
        pending={chat.pending}
        error={chat.error}
        fontSize={chat.fontSize}
        clanName={clan.name}
      />
      <ChatComposer
        draft={chat.draft}
        onDraftChange={chat.setDraft}
        onSend={chat.send}
        pending={chat.pending}
        showSuggestions={!chat.turns.length}
        suggestionLayout="wrap"
      />
    </div>
  );
}
