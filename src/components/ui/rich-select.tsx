import { useEffect, useId, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { matchesName } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";

export interface RichSelectOption<T extends string> {
  value: T;
  label: string;
  /** Dòng mô tả nhỏ dưới tên — giải thích lựa chọn bằng lời dễ hiểu. */
  description?: string;
  /** Hình bên trái (avatar, khung…); nhận cỡ px: nhỏ ở ô đã chọn, to ở danh sách. */
  leading?: (size: number) => React.ReactNode;
}

/**
 * Ô chọn xổ xuống có MỤC TUỲ BIẾN: mỗi dòng có hình, tên và mô tả (`<select>` gốc chỉ hiện chữ
 * thuần). Dùng khi từng lựa chọn cần giải thích hoặc cần hình để nhận ra — vd. Con chung với ai,
 * Viền avatar. Lựa chọn chỉ là chữ ngắn thì dùng `Select` / `OptionSelect`.
 *
 * Ô và dòng cao, chữ cỡ thường: người dùng chủ yếu là người lớn tuổi.
 */
export function RichSelect<T extends string>({
  label,
  hint,
  ariaLabel,
  value,
  onChange,
  options,
  searchable,
}: {
  /** Hiện ô lọc đầu danh sách (gõ không cần dấu). Mặc định: tự bật khi có hơn 7 lựa chọn. */
  searchable?: boolean;
  label?: string;
  /** Dòng giải thích ngay dưới nhãn, trước ô chọn. */
  hint?: string;
  ariaLabel: string;
  value: T;
  onChange: (value: T) => void;
  options: RichSelectOption<T>[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const showSearch = searchable ?? options.length > 7;
  const shown = options.filter(
    (o) =>
      !query.trim() ||
      matchesName(o.label, query) ||
      (o.description ? matchesName(o.description, query) : false),
  );
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    onChange(options[(i + dir + options.length) % options.length].value);
  };

  // Ô đã chọn cao bằng Input/Select (h-12) nên chỉ hiện hình nhỏ + tên; hình to và mô tả nằm ở danh sách.
  const body = (o: RichSelectOption<T>, compact: boolean) => (
    <>
      {o.leading?.(compact ? 32 : 40)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{o.label}</span>
        {!compact && o.description && (
          <span className="block text-sm text-muted-foreground">
            {o.description}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div className="space-y-1.5" ref={rootRef}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label ? undefined : ariaLabel}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            }
          }}
          className="flex h-12 w-full items-center gap-3 rounded-md border border-input bg-background px-3 text-left ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {current && body(current, true)}
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <ul
            role="listbox"
            aria-label={ariaLabel}
            className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
          >
            {showSearch && (
              <li role="presentation" className="p-1">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") close();
                    else if (e.key === "Enter") {
                      e.preventDefault();
                      if (shown[0]) {
                        onChange(shown[0].value);
                        close();
                      }
                    }
                  }}
                  placeholder={t`Gõ để lọc (không cần dấu)`}
                  aria-label={t`Lọc danh sách`}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </li>
            )}
            {shown.length === 0 && (
              <li className="px-3 py-3 text-sm italic text-muted-foreground">
                {t`Không có kết quả khớp.`}
              </li>
            )}
            {shown.map((o) => {
              const selected = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-sm px-2 py-2",
                    selected ? "bg-primary/10 font-medium" : "hover:bg-muted",
                  )}
                >
                  {body(o, false)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
