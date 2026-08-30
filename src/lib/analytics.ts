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
 * Pageviews are NOT auto-tracked (`data-auto-track="false"`). Umami's
 * auto-tracker records `location.pathname + search + hash` verbatim,
 * and two of our URL shapes carry secrets:
 *
 *   - Supabase auth uses the implicit flow (see lib/supabase.ts), so
 *     right after a login the URL is `/clans#access_token=<JWT>` — a
 *     JWT that decodes to the user's email, plus a refresh_token.
 *   - Capability links (`/share/:token`, `/join/:token`, …) put a
 *     bearer-equivalent secret in the path.
 *
 * Both were landing in the analytics DB, readable by anyone holding
 * an Umami share link. So we drive pageviews ourselves from the
 * router (see components/AnalyticsTracker.tsx) and push every URL
 * through `sanitizeUrl()` first.
 *
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
 * Path prefixes whose next segment is a capability secret — anyone
 * holding the raw value can open the resource without logging in, so
 * the value must never reach the analytics DB. The segment is
 * replaced by a literal placeholder, which keeps per-route counts
 * (how many share links got opened) while dropping the secret.
 */
const SECRET_SEGMENT_ROUTES = [
  "/share",
  "/join",
  "/khoe",
  "/inlaws/confirm",
];

/** Query params that carry auth material rather than page state. */
const SECRET_PARAMS = [
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "code",
  "token",
  "token_hash",
  "otp",
];

/**
 * Strip every secret out of a URL before it is reported.
 *
 * - the hash is dropped wholesale (Supabase implicit-flow tokens live
 *   there, and we have no analytics use for fragments anyway);
 * - capability tokens in the path become `<token>`;
 * - auth-bearing query params become `<redacted>`, other params are
 *   kept because tabs/filters (`?tab=community`) are useful signal.
 */
export function sanitizeUrl(pathname: string, search = ""): string {
  let path = pathname.split("#")[0];

  for (const prefix of SECRET_SEGMENT_ROUTES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const rest = path.slice(prefix.length).replace(/^\//, "");
      if (rest) {
        const tail = rest.split("/").slice(1).join("/");
        path = `${prefix}/<token>${tail ? `/${tail}` : ""}`;
      }
      break;
    }
  }

  const raw = search.split("#")[0].replace(/^\?/, "");
  if (!raw) return path;

  const params = new URLSearchParams(raw);
  for (const key of SECRET_PARAMS) {
    if (params.has(key)) params.set(key, "<redacted>");
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Pageviews fired before the async script finished loading. Only the
 * latest one matters — a burst during boot is the same navigation
 * being re-reported, not distinct visits.
 */
let pendingView: { url: string; title: string } | null = null;

function sendView(view: { url: string; title: string }): void {
  const u = umami();
  if (!u) {
    pendingView = view;
    return;
  }
  try {
    u.track((props) => ({ ...props, url: view.url, title: view.title }));
  } catch {
    /* fail silently — analytics must never break the app */
  }
}

/**
 * Khu quản trị KHÔNG được đếm vào số liệu sản phẩm.
 *
 * Không phải vì riêng tư — vì số liệu sai. Phân tích tháng 8 có một
 * phiên với 100 lượt xem `/clans` và 75 lượt `/admin`: đó là người vận
 * hành đang soi bảng điều khiển, nhưng nó nằm lẫn trong số liệu người
 * dùng thật và làm mọi tỉ lệ chuyển đổi trông đẹp hơn thực tế. Vài phiên
 * như vậy đủ để lái sai một quyết định sản phẩm.
 */
export function isAdminArea(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Report a pageview for the current route. Called by
 * `<AnalyticsTracker/>` on every navigation; `search` is optional so
 * callers can pass just a path.
 */
export function trackPageview(pathname: string, search = ""): void {
  if (!ENABLED || isAdminArea(pathname)) return;
  sendView({
    url: sanitizeUrl(pathname, search),
    title: typeof document === "undefined" ? "" : document.title,
  });
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
  // Pageviews are reported manually from the router so we can redact
  // auth tokens first — see the module header. Umami's own tracker
  // would send the raw URL, hash included, before React even mounts.
  s.setAttribute("data-auto-track", "false");
  s.setAttribute("data-cache", "true");
  s.addEventListener("load", () => {
    if (pendingView) {
      const view = pendingView;
      pendingView = null;
      sendView(view);
    }
  });
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
  // Cùng lý do với pageview: thao tác của admin trong khu quản trị không
  // phải hành vi người dùng. Đọc location ở đây thay vì bắt mọi nơi gọi
  // phải tự nhớ — quên một chỗ là số liệu lệch âm thầm.
  if (typeof location !== "undefined" && isAdminArea(location.pathname)) return;
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
