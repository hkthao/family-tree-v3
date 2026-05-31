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
    // Integration tests all share one PostgREST + Kong + Postgres. Running
    // them in parallel produced intermittent "invalid response from
    // upstream" failures in CI — too many concurrent requests hammered
    // the gateway. Single-fork keeps the suite stable at the cost of a
    // few seconds of wall-clock; suite still finishes in ~30s.
    fileParallelism: false,
    environmentMatchGlobs: [
      // Component tests get jsdom; everything else stays Node.
      ["src/test/components/**", "jsdom"],
      ["src/**/*.dom.test.{ts,tsx}", "jsdom"],
    ],
  },
});
