import { useEffect, useState } from "react";

/**
 * Chip góc màn báo "đang offline — đọc từ cache".
 *
 * KHÔNG tin mỗi `navigator.onLine`: cờ này hay false-positive (báo offline
 * dù vẫn có mạng) và có thể kẹt ở `false` sau một lần rớt mạng thoáng qua
 * vì sự kiện `online` không phải lúc nào cũng bắn lại. Trước đây chỉ đọc
 * `navigator.onLine` nên banner hiện hoài dù đang online.
 *
 * Cách làm: khi nghi ngờ offline (onLine === false), XÁC MINH bằng một
 * request nhẹ network-only tới API (HEAD no-cors, no-store — không bị
 * service worker trả từ cache). Chỉ hiện banner khi request thật sự fail.
 * Re-check định kỳ để tự thoát trạng thái kẹt.
 */
const PROBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;

async function reachable(): Promise<boolean> {
  // onLine === true: coi như có mạng (tránh false-positive offline). Chỉ
  // probe khi onLine nói false.
  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    return true;
  }
  try {
    // GET (không HEAD): server từ chối HEAD → 405/ERR_ABORTED gây noise +
    // bị coi là lỗi. no-cors nên fetch RESOLVE với mọi phản hồi hoàn tất
    // (kể cả 401 opaque) = mạng OK; chỉ REJECT khi mất kết nối thật.
    await fetch(`${PROBE_URL}?_=${Date.now()}`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
    });
    return true;
  } catch {
    return false;
  }
}

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const ok = await reachable();
      if (!cancelled) setOffline(!ok);
    };

    check();
    const onEvt = () => check();
    window.addEventListener("online", onEvt);
    window.addEventListener("offline", onEvt);
    // Tự kiểm tra lại để thoát trạng thái kẹt navigator.onLine.
    const timer = window.setInterval(check, 20_000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onEvt);
      window.removeEventListener("offline", onEvt);
      clearInterval(timer);
    };
  }, []);

  if (!offline) return null;

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
