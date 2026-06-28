import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

/**
 * Chip góc màn báo "đang offline — đọc từ cache".
 *
 * KHÔNG tin mỗi `navigator.onLine`: cờ này hay false-positive (báo offline
 * dù vẫn có mạng) và có thể kẹt ở `false` sau một lần rớt mạng thoáng qua
 * vì sự kiện `online` không phải lúc nào cũng bắn lại. Trước đây chỉ đọc
 * `navigator.onLine` nên banner hiện hoài dù đang online.
 *
 * Cách xác minh: khi onLine === false, gửi 1 truy vấn nhẹ qua chính
 * supabase client (đã kèm JWT khi đã đăng nhập) → trả 200 thật, KHÔNG bị
 * 401 như khi gọi thẳng /auth/v1/health không có auth. Khách chưa đăng
 * nhập thì không gọi mạng (tránh 401) — chấp nhận tin navigator.onLine.
 */
function isNetworkError(msg: string | undefined): boolean {
  return !!msg && /fetch|network|load failed|timeout/i.test(msg);
}

async function reachable(): Promise<boolean> {
  // onLine === true: coi như có mạng (tránh false-positive offline). Chỉ
  // xác minh khi onLine nói false.
  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    return true;
  }
  // getSession() đọc local, không gọi mạng. Khách (chưa đăng nhập) không
  // probe được sạch (gateway 401 mọi request thiếu JWT) → tin onLine.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  try {
    // Truy vấn cực nhẹ, có JWT → 200 (REST không bị service worker cache).
    const { error } = await supabase.from("clans").select("id").limit(1);
    // Lỗi mạng thật → offline; lỗi khác (RLS…) vẫn nghĩa là có phản hồi.
    return !isNetworkError(error?.message);
  } catch {
    return false;
  }
}

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const clearTimer = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const check = async () => {
      const ok = await reachable();
      if (cancelled) return;
      setOffline(!ok);
      // CHỈ poll lại khi đang offline (để phát hiện có mạng trở lại). Khi
      // đã online thì ngừng poll → không spam request mỗi 20s (tránh lặp
      // 401 khi navigator.onLine kẹt ở false nhưng thực ra vẫn online).
      if (!ok && timer === undefined) {
        timer = window.setInterval(check, 15_000);
      } else if (ok) {
        clearTimer();
      }
    };

    check();
    const onEvt = () => check();
    window.addEventListener("online", onEvt);
    window.addEventListener("offline", onEvt);

    return () => {
      cancelled = true;
      clearTimer();
      window.removeEventListener("online", onEvt);
      window.removeEventListener("offline", onEvt);
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
