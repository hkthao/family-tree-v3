import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { IconPlus, IconX } from "@/components/icons";

/**
 * Nút nổi "Thêm…" của màn danh sách — thay nút ở header để tiết kiệm chỗ.
 * Nằm góc dưới phải, CAO HƠN linh vật (draggable, ~48px, mặc định sát đáy
 * phải) và nút "Trợ lý" (AiChatDock, bottom-6) để không bị đè. Dưới dialog
 * (z-50) nên không che hộp thoại.
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
}: {
  to?: string;
  onClick?: () => void;
  /** Nhãn cho trình đọc màn hình + tooltip (nút chỉ có icon). */
  label: string;
  active?: boolean;
  icon?: ReactNode;
  testId?: string;
}) {
  const cls =
    "print-hide fixed bottom-[9.5rem] right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:bottom-24 lg:right-[max(1rem,calc((100vw_-_74rem)/2_+_1rem))]";
  const content = active ? <IconX className="h-6 w-6" /> : (icon ?? <IconPlus className="h-6 w-6" />);
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
