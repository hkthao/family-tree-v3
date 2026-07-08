import { useState, type ReactNode } from "react";

import { IconChevronDown, IconChevronUp, IconSettings } from "@/components/icons";

/**
 * Khu bộ lọc thu gọn trên mobile để tiết kiệm chỗ: hiện nút gạt "Bộ lọc"
 * (kèm số lọc đang áp dụng), bấm mới mở các control. Trên desktop (sm+)
 * luôn hiện đầy đủ — nút gạt ẩn. Dùng chung cho mọi màn danh sách.
 *
 * Ô tìm kiếm nên để NGOÀI component này (luôn hiện); chỉ gói các bộ lọc
 * phụ (chi/đời/sắp xếp/quy mô…) vào đây.
 */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  actions,
}: {
  children: ReactNode;
  /** Số bộ lọc đang áp dụng — hiện trên nút gạt để biết có lọc hay không. */
  activeCount?: number;
  /** Nút thao tác (thêm/nhập/…) — đặt NGANG HÀNG nút "Bộ lọc" (mobile) hoặc
   *  thành một hàng riêng ngay trên danh sách (desktop), cho gần tầm tay. */
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    // sm:contents — trên desktop lớp bọc "tan biến" để `children` (thường là
    // hàng control) thành item flex trực tiếp của parent, thẳng hàng với ô
    // tìm kiếm y như khi chưa bọc. Trên mobile là khối space-y-2 bình thường.
    <div className="space-y-2 sm:contents">
      {/* Hàng đầu (mobile): nút "Bộ lọc" bên trái + action bên phải. */}
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 h-10 text-sm"
        >
          <IconSettings className="h-4 w-4" />
          Bộ lọc
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
          {open ? (
            <IconChevronUp className="h-4 w-4" />
          ) : (
            <IconChevronDown className="h-4 w-4" />
          )}
        </button>
        {actions && (
          <div className="ml-auto flex items-center gap-1.5">{actions}</div>
        )}
      </div>
      <div className={`${open ? "block" : "hidden"} sm:contents`}>{children}</div>
      {/* Desktop: action thành một hàng riêng, căn phải, ngay trên danh sách. */}
      {actions && (
        <div className="hidden sm:flex items-center gap-2 justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
