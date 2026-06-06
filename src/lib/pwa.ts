/**
 * Service-worker lifecycle bridge.
 *
 * vite-plugin-pwa generates the SW + injects a `virtual:pwa-register`
 * helper at build time. We register it ourselves (rather than via
 * `injectRegister: 'auto'`) so we can route the "update available"
 * signal into a React banner instead of an automatic reload that
 * could clobber in-flight edits.
 *
 * Two events surface to the UI:
 *   - onNeedRefresh — a newer SW is waiting. We expose
 *     `applyPendingUpdate()` to swap it in and trigger the
 *     post-skipWaiting page reload.
 *   - onOfflineReady — first install completed; not surfaced today,
 *     but the hook is there if we ever want a "✓ ready for offline"
 *     confirmation toast.
 */

import { registerSW } from "virtual:pwa-register";

type UpdateListener = (ready: boolean) => void;

let pendingUpdate: (() => Promise<void>) | null = null;
const listeners = new Set<UpdateListener>();

/**
 * How often to ask the service worker to check the server for a new
 * sw.js. vite-plugin-pwa's default registerSW only polls on
 * focus/visibilitychange, so a PWA tab the user never refocuses
 * (e.g. installed app left open) misses updates. 60 minutes keeps
 * the network footprint trivial while making "deploy → user sees
 * banner within an hour" the worst case.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function fireListeners() {
  const ready = !!pendingUpdate;
  for (const l of listeners) l(ready);
}

export function initPwa(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // The SW runs in production builds. Vite-PWA's dev mode is opt-in
  // (devOptions.enabled in vite.config.ts) so this is a no-op during
  // `npm run dev` — the registerSW call still resolves, just without
  // an actual worker installed.
  const swUpdate = registerSW({
    immediate: false,
    onNeedRefresh() {
      pendingUpdate = async () => {
        await swUpdate(true);
        // The new SW will activate; let it claim, then reload so the
        // page picks up the new asset hashes.
        window.location.reload();
      };
      fireListeners();
    },
    onOfflineReady() {
      // intentional no-op
    },
    onRegisterError(err) {
      // Quietly log — never break the app over an SW registration hiccup.
      // eslint-disable-next-line no-console
      console.warn("[pwa] registerSW failed", err);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodic update poll so installed-PWA users (who may keep
      // the tab open for days without refocusing) eventually see
      // new builds. registration.update() asks the browser to refetch
      // sw.js with our no-store cache header; if it's changed, the
      // normal SW lifecycle fires and onNeedRefresh runs.
      setInterval(() => {
        registration.update().catch(() => {
          // Network blip is fine — try again on the next interval.
        });
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}

export function subscribeUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  // Fire immediately so a late-mounted component picks up the
  // current state without waiting for the next change.
  listener(!!pendingUpdate);
  return () => {
    listeners.delete(listener);
  };
}

export function applyPendingUpdate(): void {
  void pendingUpdate?.();
}
