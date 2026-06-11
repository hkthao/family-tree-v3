import { test } from "@playwright/test";

import {
  clearCaption,
  createEmptyClan,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #7 — Tên tự, Tên húy, Tên thụy (3 loại tên tiếng Việt cổ).
 *
 * Demo trường Tên tự / Tên húy / Tên thụy trong form thêm người.
 */
test("07 — Tên tự, tên húy, tên thụy", async ({ page }) => {
  await login(page);
  await createEmptyClan(page, "Họ Demo — Tên TV");
  await page.getByTestId("dashboard-add-person-link").click();
  await page.waitForURL(/\/people\/new$/);
  await pause(page, 800);

  await narrate(
    page,
    "Hướng dẫn: 3 loại tên — Tên tự, Tên húy, Tên thụy.",
    { ms: 2800 },
  );

  await page.getByTestId("person-name-input").fill("Nguyễn Văn Tổ");
  await pause(page, 500);

  // ─── Mở phần chi tiết khác ─────────────────────────────────
  await narrate(
    page,
    "Bấm 'Thêm chi tiết khác' để mở phần tuỳ chọn.",
  );
  const optionalBtn = page.getByTestId("show-optional-fields");
  await highlight(optionalBtn);
  await optionalBtn.click();
  await pause(page, 900);

  // ─── Tên tự ─────────────────────────────────────────────────
  await narrate(
    page,
    "Tên tự — tên hiệu khi trưởng thành, vd. 'Văn Đại'.",
    { ms: 3000 },
  );
  const courtesyInput = page.locator("#courtesy_name");
  await highlight(courtesyInput);
  await courtesyInput.click();
  await courtesyInput.pressSequentially("Văn Đại", { delay: 150 });
  await pause(page, 700);

  // ─── Tên húy ────────────────────────────────────────────────
  await narrate(
    page,
    "Tên húy — tên gọi lúc còn nhỏ, kỵ huý sau khi mất.",
    { ms: 3000 },
  );
  const nicknameInput = page.locator("#nickname");
  await highlight(nicknameInput);
  await nicknameInput.click();
  await nicknameInput.pressSequentially("Tý", { delay: 200 });
  await pause(page, 700);

  // ─── Tên thụy ───────────────────────────────────────────────
  await narrate(
    page,
    "Tên thụy — tên gọi sau khi mất, ghi trong bài vị.",
    { ms: 3000 },
  );
  const posthumousInput = page.locator("#posthumous_name");
  await highlight(posthumousInput);
  await posthumousInput.click();
  await posthumousInput.pressSequentially("Trung Hiếu", { delay: 150 });
  await pause(page, 1000);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Cả 3 đều tuỳ chọn — chỉ nhập khi bia/gia phả ghi.",
    { ms: 3000 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
