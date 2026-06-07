import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

// Pull version from package.json (single source of truth) and the
// short git SHA so the footer reads "v0.1.0 · 1a2b3c4". The SHA
// pulls from CI env vars first (GitHub Actions, Netlify build) then
// falls back to local git for `npm run dev`. Wrapped so a missing
// git binary in production builds doesn't kill the bundler.
function readCommitSha(): string {
  const fromEnv =
    process.env.GITHUB_SHA ??
    process.env.COMMIT_REF ??
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(readCommitSha()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    // @react-pdf/renderer's image pipeline uses Node's Buffer to decode
    // PNG/JPG bytes. Polyfill Buffer + a couple of related globals so
    // <Image src="..." /> works in the browser bundle.
    nodePolyfills({
      include: ["buffer", "stream", "util"],
      globals: { Buffer: true, global: true, process: true },
    }),
    // PWA: precache the app shell so the user can re-open the app
    // offline. Live data still depends on TanStack Query's IndexedDB
    // persister; this plugin only handles the JS/CSS/HTML bundle and
    // static icons + fonts.
    VitePWA({
      // We hand-wrote /public/manifest.webmanifest with the right
      // icons + theme colour. Tell the plugin to leave it alone.
      manifest: false,
      registerType: "prompt",
      injectRegister: false,
      workbox: {
        // Custom push + notificationclick handlers live in
        // /public/push-handler.js. importScripts inserts an
        // importScripts() call at the top of the generated SW so we
        // don't have to switch the whole project to injectManifest.
        importScripts: ["/push-handler.js"],
        // Precache the built app shell.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        // Don't ship Workbox debug files in prod.
        cleanupOutdatedCaches: true,
        // When the user accepts "Cập nhật" in the banner, the new SW
        // must activate AND take over the existing tab in one step.
        // Without `clientsClaim`, the post-reload navigation is still
        // intercepted by the OLD SW which serves the cached old
        // index.html — that HTML references chunk hashes that no
        // longer exist on the server, producing 404 + a white screen.
        // F5 bypasses the SW which is why the user's manual refresh
        // recovers. `skipWaiting` removes the waiting phase entirely.
        skipWaiting: true,
        clientsClaim: true,
        // Route everything inside our SPA shell to index.html so deep
        // links (e.g. /clans/abc/people) load when offline.
        navigateFallback: "/index.html",
        // Network calls to Supabase (REST, Auth, Storage, Realtime,
        // Functions) must always go to the network — caching mutations
        // or auth tokens would be wrong + dangerous. Realtime WS isn't
        // an HTTP request so it bypasses the SW automatically.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//, /^\/functions\//, /^\/realtime\//],
        runtimeCaching: [
          // App fonts (served from /public) — cache aggressively.
          {
            urlPattern: /\/fonts\/.*\.(?:woff2?|ttf)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "app-fonts",
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // App icons / avatars served from /public — cache for a week.
          {
            urlPattern: /\/(?:icons|avatars)\/.*\.(?:png|jpg|svg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "app-static-images",
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: {
        // Register the SW in `npm run dev` too so devs can verify
        // install/update flows without a build step. Workbox keeps
        // navigation requests untouched so Vite HMR still works.
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
