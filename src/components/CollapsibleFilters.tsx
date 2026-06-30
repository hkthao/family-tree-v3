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
}: {
  children: ReactNode;
  /** Số bộ lọc đang áp dụng — hiện trên nút gạt để biết có lọc hay không. */
  activeCount?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="sm:hidden inline-flex items-center gap-1.5 rounded-md border bg-card px-3 h-10 text-sm"
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
      <div className={`${open ? "block" : "hidden"} sm:block`}>{children}</div>
    </div>
  );
}
