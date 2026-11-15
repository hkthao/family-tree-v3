import { useSyncExternalStore } from "react";

import {
  EMPTY_PREFS,
  readHomePrefs,
  writeHomePrefs,
  type HomeCardKey,
  type HomePrefs,
} from "@/lib/homePrefs";

/**
 * Kho tuỳ chọn trang chủ DÙNG CHUNG toàn app (thẻ Thao tác nhanh, ngăn kéo tuỳ chỉnh, Tổng quan cùng đọc một
 * nơi): đổi ở ngăn kéo là thẻ cập nhật ngay, không cần tải lại. Đồng bộ giữa các tab qua sự kiện `storage`.
 */
let current: HomePrefs = typeof localStorage === "undefined" ? EMPTY_PREFS : readHomePrefs();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(next: HomePrefs) {
  current = next;
  writeHomePrefs(next);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => {
    current = readHomePrefs();
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Chỉ cho test: nạp lại từ localStorage. */
export function __resetHomePrefsStore() {
  current = readHomePrefs();
  emit();
}

const actions = {
  setPins: (pins: string[] | null) => set({ ...current, pins }),
  toggleHidden: (key: HomeCardKey) =>
    set({
      ...current,
      hidden: current.hidden.includes(key)
        ? current.hidden.filter((k) => k !== key)
        : [...current.hidden, key],
    }),
  bump: (key: string) =>
    set({ ...current, counts: { ...current.counts, [key]: (current.counts[key] ?? 0) + 1 } }),
  reset: () => set(EMPTY_PREFS),
};

export function useHomePrefs() {
  const prefs = useSyncExternalStore(subscribe, () => current, () => EMPTY_PREFS);
  return {
    prefs,
    /** Thẻ này có đang hiện không (mặc định hiện). */
    show: (key: HomeCardKey) => !prefs.hidden.includes(key),
    ...actions,
  };
}
