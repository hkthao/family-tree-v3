import { useEffect, useState } from "react";

import { IconMoon, IconSun } from "@/components/icons";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

/**
 * Compact light/dark toggle for the top toolbar. Shows the icon of
 * the theme you'd switch TO (sun in dark mode, moon in light mode),
 * which is the affordance pattern users expect from native OSes and
 * other web apps.
 *
 * Click logic: if currently effective dark → switch to light, else
 * → switch to dark. Always writes an explicit choice (never leaves
 * the user on "system" after a click) so the next reload reflects
 * what they just picked. The Account page still has the 3-way
 * radio for users who want to opt back into system auto.
 */
export function ThemeQuickToggle() {
  const [theme, setLocalTheme] = useState<Theme>(() => getTheme());

  useEffect(() => subscribeTheme(setLocalTheme), []);

  const dark = effectiveDark(theme);
  const next: Theme = dark ? "light" : "dark";
  const label = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
    >
      {dark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
    </button>
  );
}

function effectiveDark(t: Theme): boolean {
  if (t === "dark") return true;
  if (t === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
