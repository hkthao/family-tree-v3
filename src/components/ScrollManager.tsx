import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll behaviour across client navigations:
 *   - PUSH (tapping into a detail / new page) → jump to the top.
 *   - POP (browser Back / Forward) → restore the position the user was
 *     at on that history entry, so returning from a person/clan detail
 *     lands back on the row they tapped. Pairs with the URL-state
 *     filters (see useUrlState.ts) so Back fully restores the list.
 *   - REPLACE (our in-place filter/search updates, done with
 *     `replace: true`) → leave scroll untouched, so typing in a search
 *     box or flipping a filter doesn't yank the page to the top.
 *
 * Trang lazy-load + dữ liệu tải bất đồng bộ nên lúc quay lại trang còn NGẮN: cuộn thẳng tới vị trí
 * cũ sẽ bị cắt về gần đầu. Vì vậy khi POP ta thử lại mỗi khung hình (tối đa ~3 giây) cho tới khi
 * trang đủ cao rồi mới cuộn; người dùng tự cuộn / chạm thì dừng ngay, không giành quyền với họ.
 *
 * Positions are kept per history-entry key in memory (lost on a full
 * reload, which lands at the top anyway). The browser's own
 * restoration is disabled so it doesn't fight us.
 *
 * Mount once inside <BrowserRouter>. Renders nothing.
 */
export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef<Map<string, number>>(new Map());
  // Đang cố khôi phục vị trí: bỏ qua sự kiện scroll do chính ta / do trang còn ngắn gây ra, kẻo
  // ghi đè vị trí đích bằng giá trị bị cắt.
  const restoring = useRef(false);

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
    const save = () => {
      if (!restoring.current) positions.current.set(key, window.scrollY);
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
    };
  }, [location.key]);

  // Apply scroll on each navigation. useLayoutEffect so the jump
  // happens before paint — no flash at the wrong offset.
  useLayoutEffect(() => {
    restoring.current = false;
    if (navType === "PUSH") {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });
      return;
    }
    if (navType !== "POP") return; // REPLACE: keep the current scroll position.

    const target = positions.current.get(location.key) ?? 0;
    window.scrollTo({
      top: target,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
    if (target <= 0) return;

    // Trang chưa đủ cao (đang tải): thử lại mỗi khung hình tới khi cuộn được tới đích.
    restoring.current = true;
    const started = performance.now();
    let raf = 0;
    const stop = () => {
      restoring.current = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
    };
    const tick = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      if (maxY >= target) {
        window.scrollTo({
          top: target,
          left: 0,
          behavior: "instant" as ScrollBehavior,
        });
        // Cho khung hình sau ổn định rồi mới coi là xong (nội dung có thể còn nở thêm).
        raf = requestAnimationFrame(() => {
          positions.current.set(location.key, window.scrollY);
          stop();
        });
        return;
      }
      if (performance.now() - started > 3000) {
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
