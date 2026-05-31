import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

interface Tab {
  to: string;
  label: string;
  icon: string;
  /** Match only the exact path (e.g. for the dashboard index route). */
  end?: boolean;
}

interface Props {
  /** Routes scoped to this clan. */
  tabs: Tab[];
}

const GRID_COLS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/**
 * Sticky bottom tab bar. Mobile-first: large tap targets (≥56px), icon +
 * label per tab (no icon-only — older users need text), high-contrast
 * active state.
 */
export function BottomTabBar({ tabs }: Props) {
  return (
    <nav
      // Hidden on lg+: at that width the left drawer is already pinned
      // and serves the navigation role.
      className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background safe-area-bottom lg:hidden"
      aria-label="Điều hướng chính"
    >
      <ul className={cn("grid max-w-xl mx-auto", GRID_COLS[tabs.length] ?? "grid-cols-4")}>
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end ?? tab.to.endsWith("/")}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
