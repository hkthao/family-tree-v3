import { useState } from "react";

export type AlmanacPrefKey = "hoangDao" | "truc" | "tu" | "tietKhi" | "kieng";

export type AlmanacPrefs = Record<AlmanacPrefKey, boolean>;

const DEFAULT_PREFS: AlmanacPrefs = {
  hoangDao: true,
  truc: true,
  tu: true,
  tietKhi: true,
  kieng: true,
};

export const ALMANAC_PREF_ITEMS: { key: AlmanacPrefKey; label: string }[] = [
  { key: "hoangDao", label: "Ngày & giờ hoàng đạo" },
  { key: "truc", label: "Trực & việc nên/kiêng" },
  { key: "tu", label: "Nhị thập bát tú (28 sao)" },
  { key: "tietKhi", label: "Tiết khí" },
  { key: "kieng", label: "Cảnh báo ngày kiêng" },
];

const STORAGE_KEY = "almanac-display-prefs";

/** Tuỳ chọn hiển thị các loại thông tin lịch — lưu localStorage, dùng chung
 *  cho thẻ Hôm nay và trang Xem ngày tốt. */
export function useAlmanacPrefs() {
  const [prefs, setPrefs] = useState<AlmanacPrefs>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
      /* localStorage không dùng được → mặc định */
    }
    return DEFAULT_PREFS;
  });

  const toggle = (key: AlmanacPrefKey) =>
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* bỏ qua */
      }
      return next;
    });

  return { prefs, toggle };
}

/** Hàng nút bật/tắt (chip) — bật = tô đậm có ✓, tắt = viền mờ. */
export function AlmanacDisplayToggles({
  prefs,
  toggle,
}: {
  prefs: AlmanacPrefs;
  toggle: (key: AlmanacPrefKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALMANAC_PREF_ITEMS.map((it) => {
        const on = prefs[it.key];
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => toggle(it.key)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {on ? "✓ " : ""}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
