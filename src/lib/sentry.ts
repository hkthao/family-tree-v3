import * as Sentry from "@sentry/react";

/**
 * Bootstrap Sentry error monitoring. Idempotent — called from
 * main.tsx before render. Skipped silently when no DSN is set
 * (local dev / preview builds) so dev logs stay clean and
 * accidental misconfig doesn't break the boot.
 *
 * Release + environment metadata get baked in at build time from
 * vite's `define` (commit SHA + app version) so each Sentry
 * issue shows which deployed build it came from.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Tag every event with the deployed build (matches drawer footer
    // "v0.1.0 · 1a2b3c4"). When source maps are uploaded by the
    // deploy pipeline, Sentry uses this to symbolicate stack traces.
    release: `family-tree-v3@${__APP_VERSION__}+${__APP_COMMIT__}`,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Performance traces — sample 10% in prod, 100% in dev.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    // Don't ship session replays by default (privacy + cost).
    // Replay can be flipped on per-environment via env var later.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Filter out chrome-extension noise + the network errors we
    // expect when the user is offline (TanStack will surface the
    // toast; no need to page ourselves).
    ignoreErrors: [
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /Network request failed/i,
      /Failed to fetch/i,
      /Load failed/i,
    ],
  });
}
