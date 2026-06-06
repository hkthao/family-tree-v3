import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { IconBook, IconHelp, IconX } from "@/components/icons";
import { helpSlugFor } from "@/lib/helpMap";
import { DOCS_BY_SLUG } from "@/pages/docs/registry";
import { cn } from "@/lib/utils";

/**
 * Always-visible "?" in the header. Click → slides a side panel in
 * from the right with the doc article that matches the current route
 * (see `helpSlugFor`). If no doc matches, the button is hidden — we
 * never want a button that dumps the user on an unrelated page.
 *
 * The panel renders the same React component the /docs/:slug page
 * uses, so prose stays in one place. A "Mở trang đầy đủ" link at the
 * bottom takes the user to the standalone doc page if they want to
 * leave the current screen.
 */
export function HelpButton() {
  const { pathname } = useLocation();
  const slug = helpSlugFor(pathname);
  const [open, setOpen] = useState(false);

  // Close the panel when the route changes — otherwise it lingers
  // when the user navigates inside the article (e.g. via the "open
  // full page" link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while the panel is open (mobile)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!slug) return null;
  const article = DOCS_BY_SLUG[slug];
  if (!article) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hướng dẫn cho trang này"
        title="Hướng dẫn"
        className="h-10 w-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <IconHelp className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Panel — full-screen on mobile, 480px sheet on lg+. The
          backdrop sits at z-50; the panel rides one above so a click
          on the article doesn't fall through. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Hướng dẫn: ${article.title}`}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-[51] w-full sm:w-[480px] max-w-full",
          "bg-background border-l shadow-xl flex flex-col",
          "transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="border-b px-4 flex items-center justify-between gap-3 h-[56px] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <IconBook className="h-5 w-5 text-primary shrink-0" />
            <p className="font-semibold truncate">Hướng dẫn</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4">
            {article.title}
          </h2>
          <article>
            <article.Body />
          </article>
        </div>

        <footer className="border-t px-4 py-3 shrink-0">
          <Link
            to={`/docs/${article.slug}`}
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <IconBook className="h-4 w-4" />
            Mở trong trang Hướng dẫn đầy đủ →
          </Link>
        </footer>
      </aside>
    </>
  );
}
