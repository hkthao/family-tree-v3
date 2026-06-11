import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #18 — Nhập từ Excel.
 *
 * Demo UI nhập từ file Excel — không pick file thật, chỉ xem trang.
 */
test("18 — Nhập từ Excel", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/import`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1800);

  await narrate(
    page,
    "Hướng dẫn: Nhập gia phả lớn từ file Excel.",
    { ms: 2800 },
  );

  await narrate(
    page,
    "Định dạng .xlsx hoặc .csv. Các cột: ID, Họ tên, Giới tính, …",
    { ms: 3400 },
  );

  // Highlight nút tải file mẫu.
  await narrate(
    page,
    "Tải file mẫu để biết cấu trúc cột chuẩn.",
  );
  const templateBtn = page.getByRole("button", { name: /Tải file mẫu/ });
  await highlight(templateBtn);
  await pause(page, 1500);

  await narrate(
    page,
    "Sau khi chọn file, app phân tích và hiện preview + lỗi (nếu có).",
    { ms: 3600 },
  );

  await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
  await pause(page, 1500);

  await narrate(
    page,
    "Sửa lỗi rồi bấm 'Nhập' — gia phả sẽ được tạo từ file.",
    { ms: 3200 },
  );

  await clearCaption(page);
  await pause(page, 400);
});
