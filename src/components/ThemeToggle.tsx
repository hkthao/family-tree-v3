import { useEffect, useState } from "react";

import {
  getPalette,
  getTheme,
  PALETTES,
  setPalette,
  setTheme,
  subscribeTheme,
  type PaletteId,
  type Theme,
} from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; description: string }[] = [
  {
    value: "system",
    label: "Hệ thống",
    description: "Theo cài đặt thiết bị / trình duyệt.",
  },
  {
    value: "light",
    label: "Sáng",
    description: "Nền giấy ấm, mực đậm.",
  },
  {
    value: "dark",
    label: "Tối",
    description: "Nền mực, tiết kiệm mắt trong điều kiện thiếu sáng.",
  },
];

/**
 * Radio group for the colour theme: hệ thống / sáng / tối. Used in
 * Account settings. Selection persists to localStorage via
 * lib/theme.ts and applies immediately (no save button).
 */
export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<Theme>(() => getTheme());
  const [palette, setLocalPalette] = useState<PaletteId>(() => getPalette());

  useEffect(
    () =>
      subscribeTheme((t) => {
        setLocalTheme(t);
        setLocalPalette(getPalette());
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-2">
          Chế độ sáng / tối
        </legend>
        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="theme"
                checked={theme === opt.value}
                onChange={() => setTheme(opt.value)}
                className="mt-1.5 h-4 w-4 accent-primary"
              />
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-2">Bảng màu</legend>
        <p className="text-sm text-muted-foreground">
          Bảng màu theo Material Design; áp dụng ngay, không cần lưu.
        </p>
        <div
          role="radiogroup"
          aria-label="Bảng màu"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={palette === p.id}
              onClick={() => setPalette(p.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                palette === p.id
                  ? "border-primary bg-primary/10 font-medium"
                  : "hover:border-primary"
              }`}
            >
              <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                <span
                  className="h-5 w-5 rounded-full border border-background"
                  style={{ background: p.light }}
                />
                <span
                  className="h-5 w-5 rounded-full border border-background"
                  style={{ background: p.dark }}
                />
              </span>
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
