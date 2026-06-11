import { test } from "@playwright/test";

import {
  clearCaption,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #11 — Việc cần làm (gap board).
 *
 * Trang Todo tự dò ai thiếu năm sinh/cha-mẹ/ảnh/âm-lịch để cả họ cùng
 * bổ sung. Demo trên clan 50 người của small-admin (có nhiều gaps).
 */
test("11 — Việc cần làm", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/todo`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1800);

  await narrate(
    page,
    "Hướng dẫn: 'Việc cần làm' — app tự dò ai thiếu dữ liệu.",
    { ms: 3200 },
  );

  await narrate(
    page,
    "Chia theo loại: thiếu năm sinh, cha mẹ, ảnh, âm lịch…",
    { ms: 3000 },
  );

  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 2200);

  await narrate(
    page,
    "Bấm vào từng người để sửa nhanh — đóng góp cùng nhau.",
    { ms: 3000 },
  );

  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 2000);

  await narrate(
    page,
    "Tỉ lệ hoàn thành lên dần khi cả họ cùng góp.",
    { ms: 2800 },
  );

  await clearCaption(page);
  await pause(page, 400);
});
