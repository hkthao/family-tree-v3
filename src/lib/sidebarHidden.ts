import { useCallback, useSyncExternalStore } from "react";

/**
 * Ẩn / hiện menu trái trên máy tính (≥ lg). Nhớ trong localStorage; ghi `data-sidebar="hidden"` lên
 * <html> để CSS toàn cục (index.css) bỏ phần đệm `lg:pl-72` của mọi trang — nội dung tràn ra khi menu ẩn.
 * Trên điện thoại menu vẫn là ngăn kéo mở bằng ☰, không bị ảnh hưởng.
 */
const KEY = "ui:sidebar-hidden";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let hidden = typeof window === "undefined" ? false : read();

function apply() {
  if (typeof document === "undefined") return;
  if (hidden) document.documentElement.dataset.sidebar = "hidden";
  else delete document.documentElement.dataset.sidebar;
}
apply();

export function setSidebarHidden(next: boolean) {
  hidden = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* hết chỗ lưu thì thôi — chỉ mất việc nhớ lựa chọn */
  }
  apply();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** [đang ẩn?, đảo trạng thái] */
export function useSidebarHidden(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, () => hidden, () => false);
  const toggle = useCallback(() => setSidebarHidden(!hidden), []);
  return [value, toggle];
}
