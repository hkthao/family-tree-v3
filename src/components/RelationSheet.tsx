import { useEffect } from "react";

import { IconX } from "@/components/icons";

interface RelationSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Bottom-sheet on mobile, centered dialog on desktop. Used to embed
 * the AddSpouse/AddChild/AddParent forms inside PersonDetail so adding
 * a relation no longer requires a separate page navigation. Body
 * scrolls; backdrop tap + ESC close.
 */
export function RelationSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: RelationSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Outer is always a flex container — on mobile it's a column that
    // makes the inner card stretch via flex-1 (no need for the 100dvh
    // trick, which iOS Safari gets wrong with the dynamic toolbar);
    // on desktop it centers the inner card with sm:items-center +
    // sm:justify-center. inset-0 already guarantees the outer fills
    // the visual viewport, so the inner inherits a stable height.
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/40 sm:items-center sm:justify-center sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          bg-card shadow-lg flex flex-col border min-h-0
          flex-1 w-full
          sm:flex-none sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg
        "
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>
        {/* Body scroll. Intentionally NO padding-bottom: forms inside
            this sheet have a sticky action bar at the bottom, and any
            pb here would leave a gap where scrolling content peeks
            below the bar. Sticky bars carry their own padding.

            `min-h-0` is required for the inner overflow to actually
            scroll inside a flex-col parent — flex items default to
            min-height:auto which makes them grow to content size and
            silently disables overflow. EditPerson is the first form
            in this sheet long enough to surface the bug. */}
        <div className="overflow-y-auto px-5 pt-4 flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
