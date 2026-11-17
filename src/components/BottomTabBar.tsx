import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";
interface Tab {
  to: string;
  label: string;
  /**
   * Outline icon (lucide-style). Uses `currentColor`, so it tints
   * with the surrounding text colour automatically — selected tab
   * gets `text-primary`, others `text-muted-foreground`.
   */
  icon: ReactNode;
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
      // iOS Safari: khi cuộn, thanh công cụ của trình duyệt thu/giãn làm phần `fixed` trễ một nhịp và lộ một dải nội dung
      // phía dưới thanh tab. Hai biện pháp: (1) lên lớp đồ hoạ riêng (translateZ) để vẽ đồng bộ với cuộn; (2) kéo dài nền
      // xuống dưới mép (after:) để dải hở thoáng qua cũng có nền che, thay vì lòi nội dung trang.
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-gold/30 bg-background pb-[env(safe-area-inset-bottom)] [transform:translateZ(0)] [backface-visibility:hidden] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-28 after:bg-background lg:hidden"
      aria-label={t`Điều hướng chính`}
    >
      <ul
        className={cn(
          "grid max-w-xl mx-auto",
          GRID_COLS[tabs.length] ?? "grid-cols-4",
        )}
      >
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end ?? tab.to.endsWith("/")}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-[3px] w-8 rounded-full bg-primary"
                    />
                  )}
                  <span className="inline-flex items-center justify-center h-6 w-6">
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
