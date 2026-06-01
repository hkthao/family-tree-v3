import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
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
        // Precache the built app shell.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        // Don't ship Workbox debug files in prod.
        cleanupOutdatedCaches: true,
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
        // Lets us test the SW path in `npm run dev`. Off by default
        // would require running `vite preview` after a build.
        enabled: false,
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
