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
    <div
      className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:bg-black/40 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          bg-card shadow-lg flex flex-col border
          h-[100dvh] w-full
          sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:rounded-lg
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
            below the bar. Sticky bars carry their own padding. */}
        <div className="overflow-y-auto px-5 pt-4 flex-1">{children}</div>
      </div>
    </div>
  );
}
