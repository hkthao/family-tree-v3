import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #15 — Đóng góp có duyệt từ cộng đồng.
 *
 * Editor đề xuất sửa → Admin duyệt. Video demo phía Admin xem danh
 * sách đóng góp + click vào 1 mục để xem diff.
 */
test("15 — Đóng góp có duyệt", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/contributions`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1800);

  await narrate(
    page,
    "Hướng dẫn: Đóng góp có duyệt — cách họ cùng làm gia phả.",
    { ms: 3200 },
  );

  await narrate(
    page,
    "Người trong họ đề xuất sửa, admin xem và quyết định.",
    { ms: 3000 },
  );

  // Tab "Chờ duyệt" / "Đã duyệt" / etc.
  await narrate(
    page,
    "Tab 'Chờ duyệt' liệt kê các đề xuất chưa xử lý.",
    { ms: 3000 },
  );

  // Nếu có đóng góp, click vào cái đầu.
  const firstItem = page
    .locator('a[href*="/contributions/"]:not([href$="/contributions"])')
    .first();
  if (await firstItem.isVisible().catch(() => false)) {
    await narrate(page, "Bấm vào 1 đề xuất để xem chi tiết.");
    await highlight(firstItem);
    await firstItem.click();
    await page.waitForLoadState("networkidle");
    await pause(page, 2000);

    await narrate(
      page,
      "App hiện diff: cột 'Hiện tại' vs 'Đề xuất' — chọn duyệt hay từ chối.",
      { ms: 3600 },
    );
  } else {
    await narrate(
      page,
      "Chưa có đề xuất nào — khi có, danh sách sẽ hiện ở đây.",
      { ms: 3000 },
    );
  }

  await narrate(
    page,
    "Mỗi quyết định tự gửi email cho người đề xuất.",
    { ms: 3000 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
