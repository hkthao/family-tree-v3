import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { initPwa } from "./lib/pwa";
import { persister, queryClient } from "./lib/queryClient";
import { initSentry } from "./lib/sentry";
import { initTheme } from "./lib/theme";
import "./index.css";

// Sentry first — captures any error in subsequent boot steps too.
initSentry();
initTheme();
initPwa();
initAnalytics();

// iOS Safari: block pinch-zoom + double-tap-zoom. The viewport meta
// `user-scalable=no` is ignored on iOS 10+; the only reliable knob
// is preventing the proprietary gesturestart/gesturechange events.
// Tree page's family-chart container opts back in via touch-action:none.
if (typeof window !== "undefined") {
  const block = (e: Event) => e.preventDefault();
  window.addEventListener("gesturestart", block);
  window.addEventListener("gesturechange", block);
  window.addEventListener("gestureend", block);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div
          role="alert"
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "Be Vietnam Pro, system-ui, sans-serif",
            background: "#FBF7F0",
            color: "#2A2320",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontFamily: "Noto Serif, Georgia, serif", color: "#7A2E2E" }}>
              Có lỗi xảy ra
            </h1>
            <p style={{ color: "#7A6F66" }}>
              Tải lại trang để tiếp tục. Nếu lỗi lặp lại, báo cho quản trị.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: "10px 24px",
                background: "#7A2E2E",
                color: "#FBF7F0",
                border: 0,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      }
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // 24h — past this, the persisted blob is dropped on hydrate.
          maxAge: 1000 * 60 * 60 * 24,
          // Bump when query key shapes change to invalidate old caches.
          // v2: clan-detail now includes data_version (cache freshness);
          //     dashboard + clan-stats added.
          // v3: tree-data query path now branches on member vs non-member
          //     (persons_public_safe view). Pre-fix browsers cached the
          //     blocked-by-RLS empty result for public-clan visitors; this
          //     bust forces a clean refetch through the new code path.
          // v4: clan_posts query shape thay đổi từ ClanPost[] sang
          //     {rows, total} cho pagination; persisted cache cũ dạng
          //     array khiến postsQ.data.total undefined → "no posts".
          buster: "v4",
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
