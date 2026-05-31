import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
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
