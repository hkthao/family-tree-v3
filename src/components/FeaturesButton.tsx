import { useLocation, useNavigate } from "react-router-dom";

import { IconGrid } from "@/components/icons";
import { HubView } from "@/components/HubView";
import { usePanel } from "@/components/panel/usePanel";
import { SidePanel } from "@/components/SidePanel";
import { useAuth } from "@/hooks/useAuth";
import type { HubTile } from "@/hooks/useHubGroups";

import { t } from "@lingui/core/macro";

/**
 * Nút "Tính năng" ở thanh đầu trang → ngăn kéo bên phải (`?panel=features`) liệt kê MỌI tính năng của
 * hub "Tất cả tính năng" (cùng nguồn `useHubGroups`): đang ở trang nào cũng mở được, xem và chuyển
 * tính năng khác mà không phải quay về trang hub. Có ô lọc không dấu; mục đang mở được tô sáng;
 * badge việc chờ và nhãn "Mới" vẫn hiện.
 */
export function FeaturesButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { current, open: openPanel, close: closePanel } = usePanel();
  const open = current === "features";
  if (!user) return null;

  // Đi sang tính năng khác: panel do app mở đã đẩy 1 history entry → THAY entry đó, để Back từ trang
  // đích về trang cũ chứ không mở lại panel (cùng cách với chuông thông báo).
  const go = (tile: HubTile) => {
    if (!tile.to) return;
    const pushed = (location.state as { panelOpened?: boolean } | null)
      ?.panelOpened;
    navigate(tile.to, { replace: !!pushed });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel("features"))}
        aria-label={t`Tất cả tính năng`}
        title={t`Tất cả tính năng`}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
      >
        <IconGrid className="h-[18px] w-[18px]" />
      </button>

      <SidePanel
        open={open}
        title={t`Tính năng`}
        subtitle={t`Chọn một mục để mở`}
        onClose={closePanel}
        size="lg"
      >
        <HubView variant="panel" onSelect={go} activePath={location.pathname} />
      </SidePanel>
    </>
  );
}
