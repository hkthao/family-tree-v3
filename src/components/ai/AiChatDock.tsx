import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AiChatView } from "@/components/ai/AiChatView";
import { FAB_RIGHT_LG } from "@/components/Fab";
import {
  IconChevronDown,
  IconMaximize,
  IconSparkles,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { track } from "@/lib/analytics";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import type { ClanDetail } from "@/lib/queries/clan-detail";

import { t } from "@lingui/core/macro";
/**
 * Khung chat gắn bên phải (cao hết cửa sổ, đẩy nội dung sang trái) — chỉ trên máy tính.
 * Điện thoại mở chat bằng ngăn kéo toàn màn hình (`?panel=chat`, xem PanelHost).
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

/**
 * TẠM ẨN nút/khung trợ lý nổi (đang vướng màn hình khi xem và nhập dữ liệu). Đặt `true` để bật lại — mọi thứ
 * khác (trang `/tro-ly`, ngăn kéo chat trên điện thoại, gợi ý "Hỏi trợ lý AI") giữ nguyên.
 */
export const FLOATING_ASSISTANT_ENABLED = false;

const OPEN_KEY = "family-tree:ai-dock-open";
const DOCK_WIDTH = "24rem";
/** Phát từ nơi khác để mở khung dock (xem PanelHost, ?panel=chat). */
export const AI_DOCK_OPEN_EVENT = "family-tree:ai-dock-open";

export function AiChatDock({ clan }: { clan: ClanDetail }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const aiEnabled = useAiEnabled();
  const { pathname } = useLocation();

  // Trang trợ lý toàn màn hình đã là chính nó — hai khung cùng lúc thì
  // vừa thừa vừa dễ nhầm cái nào là cái đang nghe.
  const onChatPage = pathname.endsWith("/tro-ly");

  const enabled =
    FLOATING_ASSISTANT_ENABLED &&
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

  // Cho nơi khác (menu "Trợ lý dòng họ", ?panel=chat) mở khung này.
  useEffect(() => {
    const onOpen = () => setOpenPersisted(true);
    window.addEventListener(AI_DOCK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(AI_DOCK_OPEN_EVENT, onOpen);
  }, [setOpenPersisted]);

  // Khung gắn bên phải: báo bề rộng cho layout chừa chỗ (và các nút nổi né ra).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ai-dock-w", open ? DOCK_WIDTH : "0px");
    return () => root.style.setProperty("--ai-dock-w", "0px");
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
        className={`fixed bottom-[5.75rem] right-4 z-40 flex h-10 items-center gap-1.5 rounded-full bg-primary pl-3 pr-4 text-sm font-medium text-primary-foreground ${FAB_RIGHT_LG} shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
      >
        <IconSparkles className="h-4 w-4" />
        {t`Trợ lý`}
      </button>
    );
  }

  return (
    <div
      data-ai-dock
      role="complementary"
      aria-label={t`Trợ lý dòng họ`}
      // Gắn cố định bên phải, cao hết cửa sổ: không đè lên nội dung mà ĐẨY nó
      // sang trái (ClanLayout đọc --ai-dock-w), nên vẫn vừa xem vừa hỏi được.
      className="fixed bottom-0 right-0 top-0 z-40 flex w-[24rem] flex-col border-l bg-background shadow-xl"
    >
      <AiChatView
        clan={clan}
        variant="dock"
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/clans/${clan.id}/tro-ly`)}
              aria-label={t`Mở toàn màn hình`}
              title={t`Mở toàn màn hình`}
              className="h-9 w-9"
            >
              <IconMaximize className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpenPersisted(false)}
              aria-label={t`Thu nhỏ khung trò chuyện`}
              title={t`Thu nhỏ`}
              className="h-9 w-9"
            >
              <IconChevronDown className="h-5 w-5" />
            </Button>
          </>
        }
      />
    </div>
  );
}
