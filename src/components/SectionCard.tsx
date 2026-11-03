import { useState, type ReactNode } from "react";

import { IconChevronDown, IconChevronUp } from "@/components/icons";

const KEY_PREFIX = "family-tree:section-open:";

function readOpen(id: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(KEY_PREFIX + id);
    return v === null ? def : v === "1";
  } catch {
    return def;
  }
}

/**
 * Khối nội dung dạng thẻ: header (icon + tiêu đề, action bên phải, nút thu
 * gọn) tách khỏi body để phân biệt rõ từng nhóm. Trạng thái thu gọn/mở rộng
 * được nhớ theo `id` (localStorage, hỏng thì dùng `defaultOpen`).
 */
export function SectionCard({
  id,
  icon,
  title,
  action,
  defaultOpen = true,
  bodyClassName = "p-3 sm:p-4",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  /** Link/nút phụ ở header (vd "Xem tất cả →"). */
  action?: ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(KEY_PREFIX + id, o ? "0" : "1");
      } catch {
        /* chỉ là tiện ích nhớ trạng thái */
      }
      return !o;
    });
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <header
        className={`flex items-center gap-2 bg-muted/30 px-3 sm:px-4 ${open ? "border-b" : ""}`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left"
        >
          <span
            aria-hidden="true"
            className="shrink-0 text-accent [&>svg]:h-5 [&>svg]:w-5"
          >
            {icon}
          </span>
          <h3 className="truncate text-base font-semibold sm:text-lg">
            {title}
          </h3>
        </button>
        {open && action}
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? `Thu gọn ${title}` : `Mở rộng ${title}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          {open ? (
            <IconChevronUp className="h-4 w-4" />
          ) : (
            <IconChevronDown className="h-4 w-4" />
          )}
        </button>
      </header>
      {open && <div className={bodyClassName}>{children}</div>}
    </section>
  );
}
