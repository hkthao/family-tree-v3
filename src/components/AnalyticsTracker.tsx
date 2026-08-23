import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { trackPageview } from "../lib/analytics";

/**
 * Reports one pageview per navigation.
 *
 * Umami's built-in auto-tracker is disabled (see lib/analytics.ts):
 * it would send the raw URL — Supabase implicit-flow tokens in the
 * hash, capability tokens in the path — straight into the analytics
 * DB. This sends the sanitised URL instead.
 *
 * The send is deferred to the next frame so `<DocumentTitle/>` and any
 * `usePageTitle()` call in the page have had a chance to set the
 * title first. Pages whose title only resolves after a data fetch
 * still report the route default; that's fine, the URL is what the
 * dashboard groups by.
 *
 * Only `pathname + search` are watched, not `location.key` — a
 * `replace: true` filter update (useUrlState) should report the new
 * query string, but re-rendering the same URL should not.
 *
 * Mount once inside <BrowserRouter>. Renders nothing.
 */
export function AnalyticsTracker() {
  const { pathname, search } = useLocation();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const url = pathname + search;
    if (last.current === url) return;
    last.current = url;

    const id = requestAnimationFrame(() => trackPageview(pathname, search));
    return () => cancelAnimationFrame(id);
  }, [pathname, search]);

  return null;
}
