import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";

import type { ChipTone } from "@/components/Chip";
import { previewLines } from "@/lib/announcementFormat";

/** Màu icon thuần theo tông chip (mức độ tin). */
export const TONE_TEXT: Record<ChipTone, string> = {
  primary: "text-primary",
  neutral: "text-muted-foreground",
  success: "text-green-600 dark:text-green-400",
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
} as Record<ChipTone, string>;

/**
 * Một dòng danh sách kiểu ngăn kéo Thông báo — dùng chung cho Thông báo hệ thống, Cập nhật mới, Trợ giúp,
 * Podcast: icon thuần (không khung viền, không nền) bên trái, tiêu đề tối đa 2 dòng, vài dòng xem trước (mỗi ý
 * một dòng, cắt "…"), các chip (mức độ, thời gian…) dồn phải ở cuối. Đặt trong
 * `<ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">`.
 *
 * Bấm: `to` → chuyển trang; `onClick` → thường là mở ngăn kéo xem chi tiết.
 */
export function FeedRow({
  icon: Icon,
  iconClass = "text-muted-foreground",
  title,
  body,
  previewMax = 3,
  chips,
  muted = false,
  to,
  onClick,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  /** Màu icon (theo mức độ / trạng thái). */
  iconClass?: string;
  title: ReactNode;
  /** Nội dung; chỉ hiện vài dòng đầu. */
  body?: string | null;
  previewMax?: number;
  chips?: ReactNode;
  /** Đã đọc: chữ nhạt hơn. */
  muted?: boolean;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon
        aria-hidden="true"
        className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block line-clamp-2 leading-snug ${
            muted ? "font-medium text-foreground/80" : "font-semibold"
          }`}
        >
          {title}
        </span>
        {body && (
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            {previewLines(body, previewMax).map((line, i) => (
              <span key={i} className="block truncate">
                {line}
              </span>
            ))}
          </span>
        )}
        {chips && (
          <span className="mt-2 flex flex-wrap justify-end gap-1.5">
            {chips}
          </span>
        )}
      </span>
    </>
  );
  const cls =
    "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/40 sm:p-4";
  return (
    <li className={muted ? "opacity-80" : ""}>
      {to ? (
        <Link to={to} onClick={onClick} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}
