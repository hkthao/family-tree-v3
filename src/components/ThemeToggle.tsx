import { useEffect, useState } from "react";

import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

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

  useEffect(() => subscribeTheme(setLocalTheme), []);

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-medium mb-2">Giao diện</legend>
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
              <p className="text-sm text-muted-foreground">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
