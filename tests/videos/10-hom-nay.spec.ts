import { test } from "@playwright/test";

import {
  clearCaption,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #10 — Hôm nay & nhắc giỗ.
 *
 * Trang "Hôm nay" tóm tắt sự kiện hôm nay / tuần này / tháng này.
 * Demo trực tiếp trên clan 50 người của small-admin (đa số đã mất → có
 * giỗ phong phú).
 */
test("10 — Hôm nay & nhắc giỗ", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/today`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1500);

  await narrate(
    page,
    "Hướng dẫn: Trang 'Hôm nay' — giỗ và sinh nhật sắp tới.",
    { ms: 3000 },
  );

  await narrate(
    page,
    "App tự gom sự kiện hôm nay, tuần này, và tháng này.",
    { ms: 3000 },
  );

  // Cuộn nhẹ để thấy các phần tiếp theo.
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 2200);

  await narrate(
    page,
    "Mỗi sự kiện hiện rõ ngày dương + ngày âm (giỗ theo lịch âm).",
    { ms: 3200 },
  );

  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 2200);

  await narrate(
    page,
    "Bật nhắc qua email ở mục 'Cài đặt thông báo' để không quên.",
    { ms: 3000 },
  );

  await clearCaption(page);
  await pause(page, 400);
});
