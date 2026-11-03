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

/** Bảng màu (Material 3 + "oxblood" đỏ rượu gốc của app). `oxblood` không gắn
 *  data-palette nên dùng khối :root trong index.css; còn lại xem palettes.css. */
export const PALETTES = [
  { id: "blue", label: "Xanh dương", light: "#0B57D0", dark: "#A8C7FA" },
  { id: "purple", label: "Tím Material", light: "#6750A4", dark: "#D0BCFF" },
  { id: "teal", label: "Xanh ngọc", light: "#006A6A", dark: "#4CDADA" },
  { id: "green", label: "Xanh lục", light: "#1B6D2F", dark: "#8ED99B" },
  { id: "orange", label: "Cam", light: "#9A4600", dark: "#FFB68A" },
  { id: "rose", label: "Hồng", light: "#9C3A5E", dark: "#FFB1C8" },
  { id: "oxblood", label: "Đỏ rượu (gia phả)", light: "#7A2E2E", dark: "#D24545" },
] as const;
export type PaletteId = (typeof PALETTES)[number]["id"];
export const DEFAULT_PALETTE: PaletteId = "blue";
const PALETTE_KEY = "family-tree:palette";

function readPalette(): PaletteId {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    if (PALETTES.some((p) => p.id === v)) return v as PaletteId;
  } catch {
    /* private mode — ignore */
  }
  return DEFAULT_PALETTE;
}

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
const THEME_COLOR_DARK = "#1A1612";

function syncMetaThemeColor(dark: boolean): void {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) {
    const pal = PALETTES.find((p) => p.id === readPalette());
    meta.setAttribute("content", dark ? THEME_COLOR_DARK : (pal?.light ?? "#7A2230"));
  }
}

function apply(t: Theme): void {
  if (typeof document === "undefined") return;
  const dark = effectiveDark(t);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  applyPalette();
  syncMetaThemeColor(dark);
}

function applyPalette(): void {
  const id = readPalette();
  if (id === "oxblood") document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", id);
}

export function getPalette(): PaletteId {
  return readPalette();
}

export function setPalette(id: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_KEY, id);
  } catch {
    /* ignore */
  }
  apply(readStored());
  for (const l of listeners) l(readStored());
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
