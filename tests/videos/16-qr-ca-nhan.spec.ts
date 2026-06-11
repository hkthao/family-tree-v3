import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #16 — QR cá nhân (in lên bia, sổ, danh thiếp).
 *
 * Mở trang chi tiết 1 người → bấm "QR cá nhân" → modal hiển QR.
 */
test("16 — QR cá nhân", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  // Vào danh sách người và click người đầu tiên.
  await page.goto(`/clans/${clanId}/people`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1000);

  const firstPerson = page
    .locator(`a[href*="/clans/${clanId}/people/"]`)
    .filter({ hasNotText: "Thêm" })
    .first();
  await firstPerson.click();
  await page.waitForURL(/\/people\/[0-9a-f-]+$/);
  await pause(page, 1500);

  await narrate(
    page,
    "Hướng dẫn: QR cá nhân — mã riêng cho từng người.",
    { ms: 3000 },
  );

  await narrate(
    page,
    "In lên bia mộ, danh thiếp, sổ gia phả — quét là mở ngay trang cá nhân.",
    { ms: 3600 },
  );

  const qrBtn = page.getByTestId("person-qr-button");
  await highlight(qrBtn);
  await qrBtn.click();
  await pause(page, 2500);

  await narrate(
    page,
    "App tự sinh mã QR. Có thể tải PDF in trực tiếp.",
    { ms: 3000 },
  );
  await pause(page, 1500);

  // Đóng modal.
  await page.keyboard.press("Escape");
  await pause(page, 800);

  await clearCaption(page);
  await pause(page, 400);
});
