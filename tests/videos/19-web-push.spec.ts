import { test } from "@playwright/test";

import {
  clearCaption,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #19 — Thông báo đẩy (Web Push).
 *
 * Demo trang Sự kiện + nơi bật/tắt theo dõi để nhận push.
 */
test("19 — Thông báo đẩy", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/events`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1800);

  await narrate(
    page,
    "Hướng dẫn: Thông báo đẩy — nhận nhắc giỗ/sinh nhật trên điện thoại.",
    { ms: 3600 },
  );

  await narrate(
    page,
    "Vào trang 'Sự kiện' → cuộn xuống mục 'Đăng ký nhận thông báo'.",
    { ms: 3400 },
  );

  // Cuộn xuống phần SubscriptionSettings.
  await page.evaluate(() => window.scrollBy({ top: 600, behavior: "smooth" }));
  await pause(page, 2000);

  await narrate(
    page,
    "Bật theo dõi cả họ, hoặc chỉ 1 chi/người cụ thể.",
    { ms: 3200 },
  );

  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 1800);

  await narrate(
    page,
    "Trình duyệt sẽ hỏi quyền — đồng ý là xong, app sẽ đẩy thẳng vào máy.",
    { ms: 3800 },
  );

  await clearCaption(page);
  await pause(page, 400);
});
