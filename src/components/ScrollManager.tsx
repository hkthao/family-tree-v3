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

  useEffect(() => {
    if ("scrollRestoration" in history) {
      try {
        history.scrollRestoration = "manual";
      } catch {
        /* some browsers (private mode) lock this — ignore */
      }
    }
  }, []);

  // Track the current entry's scroll position, and persist it one last
  // time when navigating away (cleanup runs before the next entry's
  // restore reads it back).
  useEffect(() => {
    const key = location.key;
    const save = () => positions.current.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, [location.key]);

  // Apply scroll on each navigation. useLayoutEffect so the jump
  // happens before paint — no flash at the wrong offset.
  useLayoutEffect(() => {
    if (navType === "POP") {
      const y = positions.current.get(location.key) ?? 0;
      window.scrollTo({
        top: y,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });
    } else if (navType === "PUSH") {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });
    }
    // REPLACE: keep the current scroll position.
  }, [location.key, navType]);

  return null;
}
