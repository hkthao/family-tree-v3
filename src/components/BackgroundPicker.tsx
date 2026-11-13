import { useEffect, useState } from "react";

import { IconCheck } from "@/components/icons";
import {
  BACKGROUNDS,
  DIM_MAX,
  DIM_MIN,
  backgroundUrl,
  setBackground,
  useBackground,
} from "@/lib/background";
import { cn } from "@/lib/utils";
import { getTheme, subscribeTheme, type Theme } from "@/lib/theme";

import { t } from "@lingui/core/macro";
function isDark(t: Theme): boolean {
  return (
    t === "dark" ||
    (t === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

/** Chọn hình nền thuỷ mặc + độ phủ. Áp dụng ngay, lưu theo thiết bị (không có nút Lưu). */
export function BackgroundPicker() {
  const { id, dim } = useBackground();
  const [theme, setLocalTheme] = useState<Theme>(() => getTheme());
  useEffect(() => subscribeTheme(setLocalTheme), []);
  const dark = isDark(theme);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setBackground({ id: null })}
          aria-pressed={id === null}
          className={cn(
            "flex aspect-video items-center justify-center rounded-lg border-2 bg-muted text-sm text-muted-foreground",
            id === null
              ? "border-primary text-foreground"
              : "border-border hover:border-primary/50",
          )}
        >
          {id === null && <IconCheck className="mr-1 h-4 w-4" />}Không dùng
        </button>
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBackground({ id: b.id })}
            aria-pressed={id === b.id}
            title={b.label}
            className={cn(
              "relative aspect-video overflow-hidden rounded-lg border-2",
              id === b.id
                ? "border-primary"
                : "border-border hover:border-primary/50",
            )}
          >
            <img
              src={backgroundUrl(b.id, dark, true)}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-background/80 px-2 py-1 text-left text-xs font-medium text-foreground">
              {id === b.id && (
                <IconCheck className="h-3.5 w-3.5 text-primary" />
              )}
              {b.label}
            </span>
          </button>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="flex items-center justify-between text-sm font-medium">
          {t`Độ mờ lớp phủ`}
          <span className="text-muted-foreground">
            {Math.round(dim * 100)}%
          </span>
        </span>
        <input
          type="range"
          min={DIM_MIN * 100}
          max={DIM_MAX * 100}
          step={1}
          value={Math.round(dim * 100)}
          disabled={id === null}
          onChange={(e) => setBackground({ dim: Number(e.target.value) / 100 })}
          className="w-full accent-primary disabled:opacity-50"
        />
        <span className="block text-xs text-muted-foreground">
          {t`Cao hơn → tranh mờ hơn, chữ dễ đọc hơn. Chỉ áp dụng trong app, không áp dụng cho trang chia sẻ công khai.`}
        </span>
      </label>
    </div>
  );
}
