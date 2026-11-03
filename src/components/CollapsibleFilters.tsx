import { useState, type ReactNode } from "react";

import { IconChevronDown, IconChevronUp, IconFilter } from "@/components/icons";

/**
 * Khu bộ lọc thu gọn trên mobile để tiết kiệm chỗ: hiện nút gạt "Bộ lọc"
 * (kèm số lọc đang áp dụng), bấm mới mở các control. Trên desktop (sm+)
 * luôn hiện đầy đủ — nút gạt ẩn. Dùng chung cho mọi màn danh sách.
 *
 * Ô tìm kiếm nên để NGOÀI component này (luôn hiện); chỉ gói các bộ lọc
 * phụ (chi/đời/sắp xếp/quy mô…) vào đây. Hoặc truyền `search` để nút phễu
 * nằm ngay TRONG ô tìm kiếm (một hàng duy nhất trên mobile).
 */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  actions,
  search,
}: {
  children: ReactNode;
  /** Số bộ lọc đang áp dụng — hiện trên nút gạt để biết có lọc hay không. */
  activeCount?: number;
  /** Nút thao tác (thêm/nhập/…) — đặt NGANG HÀNG nút "Bộ lọc" (mobile) hoặc
   *  thành một hàng riêng ngay trên danh sách (desktop), cho gần tầm tay. */
  actions?: ReactNode;
  /** Ô tìm kiếm, nhận nút gạt (phễu) để nhét vào rightSlot. Desktop nút gạt ẩn
   *  và ô tìm kiếm là item đầu của hàng control. */
  search?: (toggle: ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-label="Bộ lọc"
      className={`relative inline-flex items-center justify-center rounded-md text-sm sm:hidden ${
        search
          ? `h-8 w-8 ${open ? "bg-primary/10 text-primary" : "text-muted-foreground"}`
          : "h-10 gap-1.5 border bg-card px-3"
      }`}
    >
      <IconFilter className="h-4 w-4" />
      {!search && "Bộ lọc"}
      {activeCount > 0 && (
        <span
          className={`rounded-full bg-primary px-1.5 text-xs text-primary-foreground ${
            search ? "absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px] leading-4" : ""
          }`}
        >
          {activeCount}
        </span>
      )}
      {!search && (open ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />)}
    </button>
  );
  return (
    // sm:contents — trên desktop lớp bọc "tan biến" để `children` (thường là
    // hàng control) thành item flex trực tiếp của parent, thẳng hàng với ô
    // tìm kiếm y như khi chưa bọc. Trên mobile là khối space-y-2 bình thường.
    <div className="space-y-2 sm:contents">
      {/* Hàng đầu (mobile): nút "Bộ lọc" (hoặc ô tìm kiếm chứa nút) + action. */}
      <div className={`flex items-center gap-2 ${search ? "sm:contents" : "flex-wrap sm:hidden"}`}>
        {search ? <div className="min-w-0 flex-1 sm:contents">{search(toggle)}</div> : toggle}
        {actions && <div className="ml-auto flex items-center gap-1.5 sm:hidden">{actions}</div>}
      </div>
      <div className={`${open ? "block" : "hidden"} sm:contents`}>{children}</div>
      {/* Desktop: action thành một hàng riêng, căn phải, ngay trên danh sách. */}
      {actions && <div className="hidden sm:flex items-center gap-2 justify-end">{actions}</div>}
    </div>
  );
}
