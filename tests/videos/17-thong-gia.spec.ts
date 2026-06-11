import { test } from "@playwright/test";

import {
  clearCaption,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #17 — Liên kết thông gia giữa 2 dòng họ.
 *
 * Demo trang Inlaws (cần admin 2 bên đồng ý). Không thao tác thật để
 * tránh tạo invite token rác.
 */
test("17 — Liên kết thông gia", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/inlaws`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1800);

  await narrate(
    page,
    "Hướng dẫn: Liên kết thông gia giữa 2 dòng họ.",
    { ms: 3000 },
  );

  await narrate(
    page,
    "Nối dâu/rể với cùng người đó ở dòng họ bên kia — cần admin 2 bên đồng ý.",
    { ms: 4000 },
  );

  await narrate(
    page,
    "App sinh ra link mời. Admin bên kia mở link để xác nhận.",
    { ms: 3400 },
  );

  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 2000);

  await narrate(
    page,
    "Sau khi nối, tra cứu xưng hô tự đi xuyên 2 dòng họ.",
    { ms: 3000 },
  );

  await clearCaption(page);
  await pause(page, 400);
});
