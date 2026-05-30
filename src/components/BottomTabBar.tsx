import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

interface Tab {
  to: string;
  label: string;
  icon: string;
}

interface Props {
  /** Routes scoped to this clan. */
  tabs: Tab[];
}

/**
 * Sticky bottom tab bar. Mobile-first: large tap targets (≥56px), icon +
 * label per tab (no icon-only — older users need text), high-contrast
 * active state.
 */
export function BottomTabBar({ tabs }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background safe-area-bottom"
      aria-label="Điều hướng chính"
    >
      <ul className="grid grid-cols-4 max-w-xl mx-auto">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to.endsWith("/")}
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
