import { defineConfig, devices } from "@playwright/test";

/**
 * Cấu hình Playwright dùng riêng cho việc dựng video hướng dẫn sử dụng.
 *
 * Chạy cùng 1 test ở 2 viewport — mobile (390×844) và desktop (1280×800)
 * — ra 2 file webm riêng. Mục đích: phát hành song song cho 2 đối tượng
 * người xem.
 *
 *  - `slowMo: 700ms` để mỗi click/typing đủ chậm cho người lớn tuổi.
 *  - `video: 'on'` ghi mọi spec, vào `videos/<spec>-<project>/video.webm`.
 *
 * Chạy: `npm run videos` (cả 2 project) hoặc
 *       `npm run videos -- --project=mobile` để chỉ làm 1 viewport.
 */
export default defineConfig({
  testDir: "./tests/videos",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    // Copy video.webm sang `videos/` để giữ qua các lần chạy sau —
    // Playwright tự xoá outputDir mỗi lần.
    ["./tests/videos/save-video-reporter.ts"],
  ],
  timeout: 180_000,
  use: {
    baseURL: process.env.APP_URL || "http://localhost:5173",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: {
      slowMo: 700,
    },
    video: { mode: "on" },
    screenshot: "off",
    trace: "off",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  // Playwright tự wipe outputDir mỗi lần chạy — để mặc định
  // test-results/ (đã ignore trong .gitignore). Video bền lưu ở
  // `videos/` qua save-video-reporter.ts.
  outputDir: "./test-results",
});
