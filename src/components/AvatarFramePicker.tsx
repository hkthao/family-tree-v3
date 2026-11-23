import { useEffect, useId, useRef, useState } from "react";

import {
  AVATAR_FRAMES,
  AVATAR_FRAME_LABEL,
  PersonAvatar,
  type AvatarFrame,
} from "@/components/PersonAvatar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";
/**
 * Chọn viền avatar: không viền hoặc một trong các khung (vòng nguyệt quế,
 * vàng, bạc, hoàng gia, sen, phúc lộc). Lưu ở persons.avatar_frame.
 *
 * Dropdown tự vẽ (không dùng `<select>` gốc) vì mỗi lựa chọn cần hiện hình
 * viền — lưới 11 ô cũ chiếm nửa màn hình form.
 */
export function AvatarFramePicker({
  value,
  onChange,
  gender,
  photoUrl,
  label = t`Viền avatar`,
  hint,
}: {
  value: string | null;
  onChange: (frame: AvatarFrame | null) => void;
  gender: "M" | "F";
  photoUrl?: string | null;
  label?: string;
  hint?: string;
}) {
  const options: (AvatarFrame | null)[] = [null, ...AVATAR_FRAMES];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = (value ?? null) as AvatarFrame | null;
  const nameOf = (f: AvatarFrame | null) =>
    f ? AVATAR_FRAME_LABEL[f] : t`Không viền`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const move = (dir: 1 | -1) => {
    const i = options.indexOf(current);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next);
  };

  return (
    <div className="space-y-1.5 pt-2" ref={rootRef}>
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            }
          }}
          className="flex h-14 w-full items-center gap-3 rounded-md border border-input bg-background px-3 text-left text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <PersonAvatar
            gender={gender}
            photoUrl={photoUrl}
            frame={current}
            size={40}
          />
          <span className="min-w-0 flex-1 truncate">{nameOf(current)}</span>
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
            aria-label={t`Viền avatar`}
            className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
          >
            {options.map((f) => {
              const selected = current === f;
              return (
                <li
                  key={f ?? "none"}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(f);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-base",
                    selected ? "bg-primary/10 font-medium" : "hover:bg-accent",
                  )}
                >
                  <PersonAvatar
                    gender={gender}
                    photoUrl={photoUrl}
                    frame={f}
                    size={40}
                  />
                  <span className="min-w-0 flex-1 truncate">{nameOf(f)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
