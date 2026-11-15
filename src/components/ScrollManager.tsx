import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll behaviour across client navigations:
 *   - PUSH (tapping into a detail / new page) → jump to the top.
 *   - POP (browser Back / Forward, kể cả vuốt-quay-lại trên điện thoại) → restore the position the user was
 *     at on that history entry, so returning from a person/clan detail lands back on the row they tapped.
 *     Pairs with the URL-state filters (see useUrlState.ts) so Back fully restores the list.
 *   - REPLACE (our in-place filter/search updates, done with `replace: true`) → leave scroll untouched, so
 *     typing in a search box or flipping a filter doesn't yank the page to the top.
 *
 * Trang lazy-load + dữ liệu tải bất đồng bộ nên lúc quay lại trang còn NGẮN: cuộn thẳng tới vị trí
 * cũ sẽ bị cắt về gần đầu. Vì vậy khi POP ta thử lại mỗi khung hình (tối đa ~3 giây) cho tới khi
 * trang đủ cao rồi mới cuộn; người dùng tự cuộn / chạm thì dừng ngay, không giành quyền với họ. Sau khi
 * cuộn tới nơi còn GIỮ ~1,5 giây: nội dung nở/co thêm (ảnh, thẻ tải muộn) làm lệch thì cuộn lại.
 *
 * Vị trí lưu theo khoá của mục lịch sử, ở bộ nhớ VÀ ở sessionStorage: điện thoại (nhất là iOS) hay GIẢI
 * PHÓNG trang nền để tiết kiệm RAM, nên vuốt quay lại có thể nạp LẠI cả trang — khoá mục lịch sử vẫn còn
 * trong history.state, nên đọc lại vị trí từ sessionStorage là khôi phục được. The browser's own
 * restoration is disabled so it doesn't fight us.
 *
 * Mount once inside <BrowserRouter>. Renders nothing.
 */

const STORE_KEY = "family-tree:scroll-positions-v1";

/** Tham số URL chỉ để MỞ/ĐÓNG ngăn kéo (xem components/panel/usePanel.ts) — không phải đổi trang. */
const OVERLAY_PARAMS = ["panel", "pid", "prel", "pfrom"] as const;

/**
 * Hai vị trí chỉ khác nhau ở tham số ngăn kéo (cùng đường dẫn, các tham số còn lại như bộ lọc giống hệt)?
 * Mở ngăn kéo đẩy một mục lịch sử và đóng bằng Back/vuốt-quay-lại, nhưng trang phía sau KHÔNG đổi: cuộn về đầu
 * (như khi sang trang mới) hay "khôi phục" vị trí đều làm trang giật lên đầu sau lưng ngăn kéo.
 */
export function isOverlayOnlyChange(
  a: { pathname: string; search: string },
  b: { pathname: string; search: string },
): boolean {
  if (a.pathname !== b.pathname) return false;
  const strip = (search: string) => {
    const p = new URLSearchParams(search);
    for (const k of OVERLAY_PARAMS) p.delete(k);
    p.sort();
    return p.toString();
  };
  return strip(a.search) === strip(b.search);
}
const MAX_ENTRIES = 60;

function readStore(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj)
      ? (obj as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function writeStore(map: Map<string, number>) {
  try {
    const entries = [...map.entries()].slice(-MAX_ENTRIES);
    sessionStorage.setItem(
      STORE_KEY,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    /* private mode / hết chỗ — chỉ mất khả năng khôi phục sau khi nạp lại trang */
  }
}

export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef<Map<string, number>>(
    new Map(Object.entries(readStore())),
  );
  // Đang cố khôi phục vị trí: bỏ qua sự kiện scroll do chính ta / do trang còn ngắn gây ra, kẻo
  // ghi đè vị trí đích bằng giá trị bị cắt.
  const restoring = useRef(false);
  // Vị trí (đường dẫn + query) của lần điều hướng trước, để nhận ra "chỉ mở/đóng ngăn kéo".
  const prevLoc = useRef<{ pathname: string; search: string } | null>(null);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      try {
        history.scrollRestoration = "manual";
      } catch {
        /* some browsers (private mode) lock this — ignore */
      }
    }
  }, []);

  // Track the current entry's scroll position via scroll events. KHÔNG lưu thêm ở cleanup: cleanup
  // (passive) chạy SAU khi trang mới đã cuộn về đầu, nên sẽ ghi đè vị trí của trang cũ bằng 0.
  useEffect(() => {
    const key = location.key;
    let raf = 0;
    const save = () => {
      if (restoring.current) return;
      positions.current.set(key, window.scrollY);
      // Ghi bền xuống sessionStorage, gộp theo khung hình để cuộn mượt không bị chậm.
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          writeStore(positions.current);
        });
      }
    };
    // Trang bị đẩy xuống nền / sắp bị giải phóng: chốt vị trí hiện tại ngay.
    const flush = () => {
      if (!restoring.current) positions.current.set(key, window.scrollY);
      writeStore(positions.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location.key]);

  // Apply scroll on each navigation. useLayoutEffect so the jump
  // happens before paint — no flash at the wrong offset.
  useLayoutEffect(() => {
    restoring.current = false;
    const prev = prevLoc.current;
    prevLoc.current = { pathname: location.pathname, search: location.search };
    // Mở/đóng ngăn kéo (kể cả đóng bằng vuốt-quay-lại): trang phía sau đứng yên, không cuộn lên đầu cũng không "khôi phục".
    if (prev && navType !== "REPLACE" && isOverlayOnlyChange(prev, location))
      return;
    if (navType === "PUSH") {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });
      return;
    }
    if (navType !== "POP") return; // REPLACE: keep the current scroll position.

    // Lần nạp đầu của một mục chưa từng có khoá riêng ("default") thì không có gì để khôi phục.
    const target =
      location.key === "default"
        ? 0
        : (positions.current.get(location.key) ?? 0);
    window.scrollTo({
      top: target,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
    if (target <= 0) return;

    // Trang chưa đủ cao (đang tải): thử lại mỗi khung hình tới khi cuộn được tới đích, rồi GIỮ thêm một lúc.
    restoring.current = true;
    const started = performance.now();
    let raf = 0;
    let reachedAt = 0;
    const stop = () => {
      restoring.current = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
    };
    const tick = () => {
      const now = performance.now();
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      if (maxY >= target) {
        if (Math.abs(window.scrollY - target) > 2) {
          window.scrollTo({
            top: target,
            left: 0,
            behavior: "instant" as ScrollBehavior,
          });
        }
        if (!reachedAt) reachedAt = now;
        // Giữ ~1,5 giây sau khi tới nơi: nội dung nở/co muộn làm lệch thì cuộn lại.
        if (now - reachedAt > 1500) {
          positions.current.set(location.key, window.scrollY);
          stop();
          return;
        }
      } else if (now - started > 3000) {
        // Hết kiên nhẫn: cuộn xuống cuối trang hiện có, giữ lại đích cũ cho lần quay lại sau.
        window.scrollTo({
          top: maxY,
          left: 0,
          behavior: "instant" as ScrollBehavior,
        });
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });
    window.addEventListener("pointerdown", stop, { once: true });
    return stop;
  }, [location.key, navType]);

  return null;
}
