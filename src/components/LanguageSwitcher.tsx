import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";

import { IconCheck, IconGlobe } from "@/components/icons";
import { Select } from "@/components/ui/select";
import { LOCALES, currentLocale, isLocale } from "@/lib/i18n";
import { useChangeLocale } from "@/lib/i18n/useLocale";

/** Ô chọn ngôn ngữ cho trang Tài khoản: tên mỗi ngôn ngữ viết bằng chính ngôn ngữ đó. */
export function LanguageSelect() {
  const change = useChangeLocale();
  return (
    <Select
      aria-label={t`Ngôn ngữ giao diện`}
      icon={<IconGlobe />}
      value={currentLocale()}
      onChange={(e) => isLocale(e.target.value) && void change(e.target.value)}
    >
      {LOCALES.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Nút đổi ngôn ngữ cho thanh đầu / trang công khai: biểu tượng quả cầu + mã ngôn ngữ đang dùng,
 * bấm mở danh sách nhỏ. Dùng cho khách chưa đăng nhập (trang chia sẻ) lẫn người đã đăng nhập.
 */
export function LanguageButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const change = useChangeLocale();
  const current = currentLocale();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t`Ngôn ngữ giao diện`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t`Ngôn ngữ giao diện`}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <IconGlobe className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase">{current}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border bg-card p-1 shadow-lg"
        >
          {LOCALES.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitemradio"
              aria-checked={l.id === current}
              onClick={() => {
                setOpen(false);
                if (l.id !== current) void change(l.id);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <span className="flex-1">{l.label}</span>
              {l.id === current && (
                <IconCheck className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
