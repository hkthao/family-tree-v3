import { useEffect, useState } from "react";

/**
 * Tiny corner chip that appears whenever the browser drops offline.
 * No timer / debouncing — the OS-level navigator.onLine event is
 * already coalesced. Hidden by default, no UI cost when online.
 *
 * We intentionally don't try to disable the UI or queue mutations
 * here: TanStack Query's persisted cache still serves all reads
 * from IndexedDB, and writes will error organically — the user's
 * mutation toasts (already wired across every site) carry the
 * "không kết nối được" message back to them.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-3 bottom-20 lg:bottom-4 z-30 rounded-full border bg-card px-3 py-1.5 text-xs shadow"
    >
      <span aria-hidden="true">●</span>{" "}
      <span className="text-muted-foreground">
        Đang offline — đọc từ cache
      </span>
    </div>
  );
}
