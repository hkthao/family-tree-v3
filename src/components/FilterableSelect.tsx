import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconCheck, IconChevronDown, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";
import { unaccent } from "@/lib/unaccent";

export interface FilterableOption {
  value: string;
  label: string;
}

/**
 * Select có ô tìm: một ô trông như Select; bấm thì mở danh sách nổi, con trỏ nằm sẵn ở ô tìm
 * (gõ không dấu), chọn bằng chuột / ↑ ↓ Enter, Esc hoặc bấm ra ngoài để đóng. Danh sách vẽ qua
 * portal nên không bị ngăn kéo / thẻ cắt mất. Dùng cho danh sách dài (tỉnh, xã/phường).
 */
export function FilterableSelect({
  id,
  icon,
  value,
  onChange,
  options,
  emptyLabel,
  disabled,
  filterPlaceholder = "Gõ để tìm (không cần dấu)",
  filterLabel,
  className,
}: {
  id?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: FilterableOption[];
  /** Nhãn của lựa chọn rỗng (giá trị ""): vừa là chữ khi chưa chọn, vừa là dòng "bỏ chọn". */
  emptyLabel: string;
  disabled?: boolean;
  filterPlaceholder?: string;
  filterLabel: string;
  /** Ghi đè lớp của ô bấm (vd. `h-10 text-sm` để thấp bằng nút `size="sm"`). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const all = useMemo<FilterableOption[]>(() => [{ value: "", label: emptyLabel }, ...options], [options, emptyLabel]);
  const shown = useMemo(() => {
    const q = unaccent(query);
    if (!q) return all;
    return all.filter((o) => o.value !== "" && unaccent(o.label).includes(q));
  }, [all, query]);
  const current = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    // Hết chỗ phía dưới (vd điện thoại có bàn phím) thì mở lên trên.
    const up = below < 280 && r.top > below;
    setRect({ left: r.left, top: up ? r.top : r.bottom, width: r.width, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Danh sách chỉ vẽ khi đã đo được vị trí (rect), nên ô tìm xuất hiện SAU lần mở một nhịp —
  // focus phải đợi tới lúc nó có mặt.
  const popVisible = open && !!rect;
  useEffect(() => {
    if (popVisible) inputRef.current?.focus();
  }, [popVisible]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Mở lên: bắt đầu từ mục đang chọn; gõ chữ: nhảy về kết quả đầu.
  useEffect(() => {
    if (!open) return;
    setActive(query ? (shown.length > 1 ? 1 : 0) : Math.max(0, shown.findIndex((o) => o.value === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-12 w-full items-center rounded-md border border-input bg-background px-3 py-2 pr-9 text-left text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          icon && "pl-10",
          className,
        )}
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.label ?? emptyLabel}</span>
      </button>
      {icon && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
        aria-hidden="true"
      >
        <IconChevronDown className="h-4 w-4" />
      </span>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              left: rect.left,
              width: rect.width,
              ...(rect.up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.top + 4 }),
            }}
            className="z-[100] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="relative border-b">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(shown.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const o = shown[active];
                    if (o) pick(o.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    close();
                    triggerRef.current?.focus();
                  }
                }}
                placeholder={filterPlaceholder}
                aria-label={filterLabel}
                aria-controls={listId}
                autoComplete="off"
                className="h-11 w-full bg-transparent pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Không có kết quả</li>}
              {shown.map((o, i) => {
                const selected = o.value === value;
                return (
                  <li
                    key={o.value || "__empty"}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-base",
                      i === active && "bg-muted",
                      o.value === "" && "text-muted-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1">{o.label}</span>
                    {selected && o.value !== "" && <IconCheck className="h-4 w-4 shrink-0 text-primary" />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
