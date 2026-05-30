import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // RLS tests hit a real local Supabase — be patient on first run.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environmentMatchGlobs: [
      // Component tests get jsdom; everything else stays Node.
      ["src/test/components/**", "jsdom"],
      ["src/**/*.dom.test.{ts,tsx}", "jsdom"],
    ],
  },
});
