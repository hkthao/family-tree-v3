import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { applyDocumentMeta, metaForPath } from "../lib/pageTitle";

/**
 * Override the document title (and optionally the description) with
 * text the page only knows after loading its data — a clan name, a
 * person, a Sổ tay entry.
 *
 * Pass `null` while loading; the route's static title from
 * `ROUTE_META` stays in place until real text arrives.
 *
 *   usePageTitle(clan ? `Gia phả ${clan.name}` : null, clan?.summary);
 *
 * The route's `noindex` flag is always preserved — a page must not
 * become indexable just because it set its own title.
 */
export function usePageTitle(
  title: string | null | undefined,
  description?: string | null,
): void {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!title) return;
    const route = metaForPath(pathname);
    applyDocumentMeta({
      title,
      description: description ?? route?.description ?? null,
      noindex: route?.noindex,
    });
  }, [title, description, pathname]);
}
