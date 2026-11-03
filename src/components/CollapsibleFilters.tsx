import { useState, type ReactNode } from "react";

import { FilterDrawer } from "@/components/FilterDrawer";
import { IconFilter } from "@/components/icons";

/**
 * Bộ lọc / tuỳ chọn của màn danh sách: chỉ còn một icon phễu (kèm số lọc đang
 * áp dụng); bấm mở ngăn kéo bên phải chứa các ô chọn (xem FilterDrawer) — mọi
 * cỡ màn hình, danh sách không bị chiếm chỗ. `children` nên xếp DỌC (flex-col).
 *
 * `search` nhận nút phễu để nhét vào TRONG ô tìm kiếm (rightSlot); nếu không
 * truyền, phễu là một nút riêng.
 */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  actions,
  search,
  onReset,
  title,
}: {
  children: ReactNode;
  /** Số bộ lọc đang áp dụng — hiện trên phễu để biết có lọc hay không. */
  activeCount?: number;
  /** Nút thao tác (thêm/nhập/…) — một hàng căn phải ngay dưới ô tìm kiếm. */
  actions?: ReactNode;
  /** Ô tìm kiếm, nhận nút phễu để nhét vào rightSlot. */
  search?: (toggle: ReactNode) => ReactNode;
  /** Có thì ngăn kéo hiện nút "Đặt lại". */
  onReset?: () => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Bộ lọc"
      className={`relative inline-flex items-center justify-center rounded-md text-sm ${
        search ? "h-8 w-8 text-muted-foreground hover:bg-muted" : "h-10 gap-1.5 border bg-card px-3"
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
    </button>
  );
  return (
    <>
      {search ? search(toggle) : <div className="flex items-center gap-2">{toggle}</div>}
      {actions && <div className="flex flex-wrap items-center justify-end gap-1.5">{actions}</div>}
      <FilterDrawer open={open} onClose={() => setOpen(false)} onReset={onReset} title={title}>
        {children}
      </FilterDrawer>
    </>
  );
}
