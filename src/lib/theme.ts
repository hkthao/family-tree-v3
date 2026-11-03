/**
 * Theme manager: light / dark / system.
 *
 * State lives in localStorage under `family-tree:theme`. The applied
 * mode (`light` or `dark`) is added/removed as a class on the <html>
 * element so Tailwind's `darkMode: ["class"]` strategy + the CSS
 * `.dark { … }` palette in index.css both pick it up.
 *
 * "system" follows window.matchMedia("(prefers-color-scheme: dark)").
 * Changes to the system preference re-apply automatically as long as
 * the choice is "system".
 *
 * initTheme() runs once at boot (from main.tsx). The Account page
 * uses setTheme() + a small subscribe hook to render the radio
 * group.
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "family-tree:theme";

type Listener = (t: Theme) => void;
const listeners = new Set<Listener>();
let mediaQuery: MediaQueryList | null = null;

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode — ignore */
  }
  return "system";
}

function effectiveDark(t: Theme): boolean {
  if (t === "dark") return true;
  if (t === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Status bar / address-bar color cho iOS Safari + Android Chrome.
 *  Light dùng đỏ rượu vang (primary), dark dùng "warm ink" để hợp
 *  background tối — đỏ rượu vang quá chói trong dark mode. */
const THEME_COLOR_LIGHT = "#7A2230";
const THEME_COLOR_DARK = "#1A1612";

function syncMetaThemeColor(dark: boolean): void {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) {
    meta.setAttribute("content", dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
  }
}

function apply(t: Theme): void {
  if (typeof document === "undefined") return;
  const dark = effectiveDark(t);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  syncMetaThemeColor(dark);
}

export function getTheme(): Theme {
  return readStored();
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  apply(t);
  for (const l of listeners) l(t);
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initTheme(): void {
  if (typeof window === "undefined") return;
  const t = readStored();
  apply(t);

  // Re-apply on system preference change when on auto.
  if (!mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      if (readStored() === "system") apply("system");
    });
  }
}
