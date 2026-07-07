import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Container for a row of mutually-exclusive segmented buttons. Pairs
 * with `<SegmentedButton>` children. Picks up the "inline-flex
 * rounded-md border bg-card overflow-hidden" shell pattern used in
 * 11 places across the app before this component existed.
 *
 * Use `role="group"` semantics + a required `ariaLabel` so the
 * cluster announces correctly to screen readers regardless of
 * whether the children are icon-only.
 *
 * Example:
 *   <SegmentedControl ariaLabel="Chế độ hiển thị">
 *     <SegmentedButton active={view === "list"} onClick={() => setView("list")} ariaLabel="Danh sách">
 *       <IconList className="h-4 w-4" />
 *     </SegmentedButton>
 *     <SegmentedButton active={view === "tree"} onClick={() => setView("tree")} ariaLabel="Cây">
 *       <IconGrid className="h-4 w-4" />
 *     </SegmentedButton>
 *   </SegmentedControl>
 */
export function SegmentedControl({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-md border bg-card overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Button inside a `<SegmentedControl>`. Defaults to a "text label"
 * size (`px-4 h-10 text-sm`); pass `className` to override for
 * icon-only / square / smaller variants — every layout used in the
 * app today fits in those overrides.
 *
 * The adjacent-sibling left border is applied automatically via the
 * `[&:not(:first-child)]:border-l` Tailwind selector, so callers
 * don't have to know which child position they're in.
 */
type SegmentedButtonVariant = "text" | "icon-md" | "icon-sm";

const VARIANT_CLASS: Record<SegmentedButtonVariant, string> = {
  text: "px-4 h-10",
  "icon-md": "inline-flex items-center justify-center w-10 h-10",
  "icon-sm": "inline-flex items-center justify-center w-10 h-10",
};

export function SegmentedButton({
  active,
  onClick,
  title,
  ariaLabel,
  variant = "text",
  className,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  /** Required for icon-only buttons; ignored otherwise. */
  ariaLabel?: string;
  /**
   * "text" (default) = px-4 h-10 for labeled tabs.
   * "icon-md" = w-10 h-10 square for icon-only segmented controls.
   * "icon-sm" = w-8 h-8 compact icon variant.
   */
  variant?: SegmentedButtonVariant;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "text-sm transition-colors",
        VARIANT_CLASS[variant],
        "[&:not(:first-child)]:border-l",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {children}
    </button>
  );
}
