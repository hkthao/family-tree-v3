import { useSyncExternalStore } from "react";

/**
 * Hình nền thuỷ mặc (tuỳ chọn, theo thiết bị). Tranh thật từ Wikimedia Commons — nguồn ở docs/credits.md,
 * file ở public/backgrounds/<id>-{light,dark}-{lg,sm}.webp. Lưu localStorage như lib/theme.ts; ghi
 * `data-bg="on"` lên <html> để index.css bỏ nền đặc của layout (xem khối "Hình nền" trong index.css).
 */
export const BACKGROUNDS = [
  { id: "nui-suong", label: "Núi sương" },
  { id: "son-thuy", label: "Sơn thuỷ" },
  { id: "tung-nui", label: "Tùng và núi" },
  { id: "truc", label: "Trúc" },
  { id: "sen", label: "Sen" },
  { id: "mai", label: "Mai dưới trăng" },
] as const;

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

/** Độ phủ (alpha của lớp phủ màu nền): kẹp cứng để chữ không bao giờ mất tương phản. */
export const DIM_MIN = 0.45;
export const DIM_MAX = 0.95;
const DIM_DEFAULT = 0.62;

export interface BackgroundState {
  id: BackgroundId | null;
  dim: number;
}

const KEY = "family-tree:bg";
const OFF: BackgroundState = { id: null, dim: DIM_DEFAULT };
const listeners = new Set<() => void>();

const clampDim = (n: number) => Math.min(DIM_MAX, Math.max(DIM_MIN, Number.isFinite(n) ? n : DIM_DEFAULT));

function read(): BackgroundState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<BackgroundState> | null;
    const id = BACKGROUNDS.find((b) => b.id === v?.id)?.id ?? null;
    return { id, dim: clampDim(v?.dim ?? DIM_DEFAULT) };
  } catch {
    return OFF;
  }
}

let state: BackgroundState = typeof window === "undefined" ? OFF : read();

/** Tiết kiệm dữ liệu / tương phản cao → không tải tranh. */
export function backgroundSuppressed(): boolean {
  if (typeof window === "undefined") return true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conn?.saveData || !!window.matchMedia?.("(prefers-contrast: more)").matches;
}

function apply() {
  if (typeof document === "undefined") return;
  const on = state.id !== null && !backgroundSuppressed();
  if (on) document.documentElement.dataset.bg = "on";
  else delete document.documentElement.dataset.bg;
}
apply();

export function getBackground(): BackgroundState {
  return state;
}

export function setBackground(next: Partial<BackgroundState>) {
  state = {
    id: next.id === undefined ? state.id : next.id,
    dim: clampDim(next.dim ?? state.dim),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* hết chỗ lưu thì thôi — chỉ mất việc nhớ lựa chọn */
  }
  apply();
  listeners.forEach((l) => l());
}

export function initBackground() {
  state = read();
  apply();
}

export function backgroundUrl(id: BackgroundId, dark: boolean, desktop: boolean): string {
  return `/backgrounds/${id}-${dark ? "dark" : "light"}-${desktop ? "lg" : "sm"}.webp`;
}

export function useBackground(): BackgroundState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => OFF,
  );
}
