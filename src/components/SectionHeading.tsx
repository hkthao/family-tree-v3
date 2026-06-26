import type { ReactNode } from "react";

/**
 * Tiêu đề section dùng chung — đồng nhất kiểu chữ + icon (tông accent)
 * cho mọi khối trên Dashboard và các trang khác. Có chỗ cho action
 * bên phải (vd link "Xem tất cả →").
 */
export function SectionHeading({
  icon,
  title,
  action,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="text-accent [&>svg]:h-5 [&>svg]:w-5"
        >
          {icon}
        </span>
        {title}
      </h3>
      {action}
    </div>
  );
}
