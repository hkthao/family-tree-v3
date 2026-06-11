import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type {
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

/**
 * Custom reporter để giữ video sau mỗi lần chạy.
 *
 * Playwright wipe `outputDir` (test-results/) đầu mỗi run. Reporter
 * này chạy ở `onTestEnd` — sau khi Playwright đã finalize video.webm
 * — copy sang `videos/<spec>-<project>/video.webm` để không bị xoá ở
 * run sau.
 *
 * Bật trong `playwright.config.ts` ở mảng `reporter`.
 */
const KEEP_DIR = "videos";

export default class SaveVideoReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    const videoAttachment = result.attachments.find(
      (a) => a.contentType === "video/webm" && a.path,
    );
    if (!videoAttachment?.path) return;
    if (!existsSync(videoAttachment.path)) return;

    // Spec basename: vd "01-tao-dong-ho" từ "tests/videos/01-tao-dong-ho.spec.ts"
    const specBase = basename(test.location.file, ".spec.ts");
    // Project name: "mobile" | "desktop"
    const projectName = test.parent.project()?.name ?? "default";

    const destDir = join(KEEP_DIR, `${specBase}-${projectName}`);
    mkdirSync(destDir, { recursive: true });
    const dest = join(destDir, "video.webm");
    copyFileSync(videoAttachment.path, dest);

    // In ra cho dễ thấy trong terminal.
    console.log(`  → ${dest}`);
  }
}
