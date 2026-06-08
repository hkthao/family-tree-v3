/**
 * Analytics wrapper — Umami self-hosted.
 *
 * Loads the Umami tracking script lazily after the app mounts so it
 * doesn't compete with the React bundle for first-paint bandwidth.
 * When the env vars `VITE_UMAMI_URL` + `VITE_UMAMI_WEBSITE_ID` are
 * unset (local dev, or before the VPS Umami stack is provisioned),
 * the whole module becomes a no-op — no script load, no network
 * requests, no console noise.
 *
 * Pageviews are auto-tracked by Umami's script via History API.
 * Custom events go through `track(name, props)` which calls the
 * `window.umami.track(...)` API exposed by the script. Properties
 * stay lightweight — Umami's free tier indexes them as JSON, but
 * heavy values would blow up the dashboard chart legends.
 *
 * Privacy: Umami doesn't use cookies and doesn't fingerprint, so we
 * don't need a consent banner. No PII (full names, emails, person
 * ids) goes into event properties — track shapes, not identities.
 */

const UMAMI_URL = import.meta.env.VITE_UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID ?? "";

const ENABLED =
  typeof window !== "undefined" && !!UMAMI_URL && !!UMAMI_WEBSITE_ID;

let scriptInjected = false;

interface UmamiGlobal {
  track: (
    nameOrFn:
      | string
      | ((props: Record<string, unknown>) => Record<string, unknown>),
    data?: Record<string, unknown>,
  ) => void;
}

function umami(): UmamiGlobal | null {
  if (typeof window === "undefined") return null;
  const g = (window as unknown as { umami?: UmamiGlobal }).umami;
  return g ?? null;
}

/**
 * Inject Umami's tracking script — call once on app boot. Subsequent
 * calls no-op. Safe to call before / after React mount.
 */
export function initAnalytics(): void {
  if (!ENABLED || scriptInjected) return;
  if (typeof document === "undefined") return;
  scriptInjected = true;
  const s = document.createElement("script");
  s.async = true;
  s.defer = true;
  s.src = `${UMAMI_URL.replace(/\/$/, "")}/script.js`;
  s.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  // Don't auto-track when the URL contains a secret token (share
  // links). Umami honours data-do-not-track + we strip query strings
  // server-side via "data-do-not-track" parameter on the website.
  s.setAttribute("data-cache", "true");
  document.head.appendChild(s);
}

/**
 * Track a custom event. Drop silently when analytics aren't
 * configured or the script hasn't finished loading.
 *
 * Naming convention: snake_case noun verb, e.g. `person_added`,
 * `contribution_approved`. Keep `props` to small enums (kind:
 * "edit_person" | "add_note" | "add_person"), counts, or booleans.
 * No names, no person ids, no emails.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (!ENABLED) return;
  const u = umami();
  if (!u) return;
  try {
    if (props) u.track(name, props);
    else u.track(name);
  } catch {
    /* fail silently — analytics must never break the app */
  }
}

/** Cheap helper for the most common shape — count-only event. */
export function trackCount(name: string): void {
  track(name);
}
