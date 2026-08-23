import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { applyDocumentMeta, metaForPath } from "../lib/pageTitle";

/**
 * Applies the static per-route title/description on every navigation.
 *
 * Runs before the page's own effects (it is mounted above <Routes>),
 * so a page calling `usePageTitle()` with data-derived text overrides
 * this cleanly, and gets reset back to the route default when the user
 * navigates away.
 *
 * Mount once inside <BrowserRouter>. Renders nothing.
 */
export function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = metaForPath(pathname);
    applyDocumentMeta({
      title: meta?.title ?? null,
      description: meta?.description ?? null,
      noindex: meta?.noindex,
    });
  }, [pathname]);

  return null;
}
