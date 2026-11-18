import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { IconPlus, IconX } from "@/components/icons";
import { PanelLink } from "@/components/panel/PanelLink";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import type { PanelId, PanelParams } from "@/components/panel/usePanel";

import { t } from "@lingui/core/macro";
/** Vị trí chung của Fab / FabGroup (góc dưới phải, xem chú thích bên dưới). */
/** Mép phải của cột nút nổi trên desktop: thẳng với khung nội dung, né khung chat gắn phải. */
export const FAB_RIGHT_LG =
  "lg:right-[max(calc(1rem_+_var(--ai-dock-w,0px)),calc((100vw_-_74rem_-_var(--ai-dock-w,0px))/2_+_1rem_+_var(--ai-dock-w,0px)))]";

/**
 * Điện thoại: cách mép trên thanh tab dưới 1rem — thanh tab tự khai báo chiều cao qua `--tabbar-h` khi đang hiện
 * (BottomTabBar); màn không có thanh tab (Tất cả dòng họ, trang hệ thống) thì biến bằng 0, nút chỉ cách đáy 1rem
 * (trước đây cố định 4.5rem → hở lớn ở màn không có thanh tab).
 */
export const FAB_POSITION = `print-hide fixed bottom-[calc(var(--tabbar-h,0px)_+_1rem_+_env(safe-area-inset-bottom))] right-4 z-30 lg:bottom-6 ${FAB_RIGHT_LG}`;

/** Ẩn khi cuộn xuống (chỉ điện thoại): trượt xuống dưới mép + mờ, không bấm được. */
export const FAB_HIDDEN =
  "max-lg:pointer-events-none max-lg:translate-y-[calc(100%_+_6rem)] max-lg:opacity-0";

/**
 * Nút nổi "Thêm…" của màn danh sách — thay nút ở header để tiết kiệm chỗ.
 * Mobile: ngay trên thanh tab dưới (hoặc sát đáy nếu màn không có thanh tab); cuộn xuống thì ẩn, cuộn lên thì hiện; linh vật (draggable) mặc định đặt cao hơn
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
  // Cuộn xuống thì ẩn, cuộn lên thì hiện (như app điện thoại); đang mở form (active) thì luôn hiện.
  const hidden = useHideOnScroll({ disabled: active });
  const cls = `${FAB_POSITION} inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${hidden ? FAB_HIDDEN : ""}`;
  const content = active ? (
    <IconX className="h-6 w-6" />
  ) : (
    (icon ?? <IconPlus className="h-6 w-6" />)
  );
  if (to && panel && !active) {
    return (
      <PanelLink
        to={to}
        panel={panel.id}
        panelParams={panel.params}
        aria-label={label}
        title={label}
        data-testid={testId}
        className={cls}
      >
        {content}
      </PanelLink>
    );
  }
  if (to && !active) {
    return (
      <Link
        to={to}
        aria-label={label}
        title={label}
        data-testid={testId}
        className={cls}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? t`Đóng: ${label}` : label}
      title={label}
      data-testid={testId}
      className={cls}
    >
      {content}
    </button>
  );
}
