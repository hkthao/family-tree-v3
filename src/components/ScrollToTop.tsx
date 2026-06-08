import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Land every route at the top of the page.
 *
 * Browser default for SPAs: when you back/forward, the position is
 * restored. That works on the desktop where pages are short, but on
 * mobile (and any time a long /people or /audit list is involved)
 * users find themselves staring at random rows mid-screen with no
 * landmark — they expect "back = fresh page at top" the same way
 * native apps behave.
 *
 * Strategy:
 *   - Disable the browser's automatic scroll restoration on mount
 *     so the platform doesn't fight us.
 *   - On every location change, jump scroll to (0, 0) — instant,
 *     no smooth animation; on back navigation a smooth scroll would
 *     feel sluggish on slow phones.
 *
 * Mount once inside <BrowserRouter>. Renders nothing.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      try {
        history.scrollRestoration = "manual";
      } catch {
        /* some browsers (private mode) lock this — ignore */
      }
    }
  }, []);

  useEffect(() => {
    // PUSH / REPLACE / POP — all reset. POP (back/forward) is the
    // case the user explicitly asked for; PUSH/REPLACE coverage is
    // a freebie that also feels right.
    void navType;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, navType]);

  return null;
}
