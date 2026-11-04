import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { IconPlus, IconX } from "@/components/icons";
import { PanelLink } from "@/components/panel/PanelLink";
import type { PanelId, PanelParams } from "@/components/panel/usePanel";

/** Vị trí chung của Fab / FabGroup (góc dưới phải, xem chú thích bên dưới). */
/** Mép phải của cột nút nổi trên desktop: thẳng với khung nội dung, né khung chat gắn phải. */
export const FAB_RIGHT_LG =
  "lg:right-[max(calc(1rem_+_var(--ai-dock-w,0px)),calc((100vw_-_74rem_-_var(--ai-dock-w,0px))/2_+_1rem_+_var(--ai-dock-w,0px)))]";

export const FAB_POSITION = `print-hide fixed bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] right-4 z-30 lg:bottom-6 ${FAB_RIGHT_LG}`;

/**
 * Nút nổi "Thêm…" của màn danh sách — thay nút ở header để tiết kiệm chỗ.
 * Mobile: ngay trên thanh tab dưới; linh vật (draggable) mặc định đặt cao hơn
 * nút này. Desktop: sát đáy (bottom-6); nút "Trợ lý" và linh vật nằm cao hơn nó. Dưới dialog (z-50) nên
 * không che hộp thoại.
 *
 * Desktop: căn mép phải theo khung nội dung (max-w-4xl = 56rem, nằm bên phải
 * thanh menu rộng 18rem, lề 1rem) thay vì dính mép cửa sổ.
 *
 * Truyền `to` (liên kết) hoặc `onClick` (mở form). `active` = đang mở form →
 * hiện dấu X.
 */
export function Fab({
  to,
  onClick,
  label,
  active = false,
  icon,
  testId,
  panel,
}: {
  to?: string;
  onClick?: () => void;
  /** Nhãn cho trình đọc màn hình + tooltip (nút chỉ có icon). */
  label: string;
  active?: boolean;
  icon?: ReactNode;
  testId?: string;
  /** Có thì bấm thường mở ngăn kéo (route `to` vẫn là link dự phòng). */
  panel?: { id: PanelId; params?: PanelParams };
}) {
  const cls = `${FAB_POSITION} inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
  const content = active ? <IconX className="h-6 w-6" /> : (icon ?? <IconPlus className="h-6 w-6" />);
  if (to && panel && !active) {
    return (
      <PanelLink to={to} panel={panel.id} panelParams={panel.params} aria-label={label} title={label} data-testid={testId} className={cls}>
        {content}
      </PanelLink>
    );
  }
  if (to && !active) {
    return (
      <Link to={to} aria-label={label} title={label} data-testid={testId} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? `Đóng: ${label}` : label}
      title={label}
      data-testid={testId}
      className={cls}
    >
      {content}
    </button>
  );
}
