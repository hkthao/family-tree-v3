/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constants injected by vite.config.ts `define`.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;

// Catalog dịch (.po) — plugin @lingui/vite-plugin biên dịch khi import.
declare module "*.po" {
  import type { Messages } from "@lingui/core";
  export const messages: Messages;
}
