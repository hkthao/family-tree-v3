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
 * Video #6 — Nhập ngày sinh/mất theo lịch Âm + Dương + Can Chi.
 */
test("06 — Ngày sinh âm/dương + Can Chi", async ({ page }) => {
  await login(page);
  await createEmptyClan(page, "Họ Demo — Ngày tháng");
  await page.getByTestId("dashboard-add-person-link").click();
  await page.waitForURL(/\/people\/new$/);
  await pause(page, 800);

  await narrate(
    page,
    "Hướng dẫn: Ngày sinh & ngày mất — lịch Dương, Âm, Can Chi.",
    { ms: 3000 },
  );

  // Điền tên trước (bắt buộc) — không narrate.
  await page.getByTestId("person-name-input").fill("Nguyễn Cao Tổ");
  await pause(page, 400);

  // ─── Dương lịch ─────────────────────────────────────────────
  await narrate(
    page,
    "Mặc định là lịch Dương. Chỉ nhớ năm cũng được.",
  );
  const yearInput = page.getByTestId("birth-year-input");
  await highlight(yearInput);
  await yearInput.click();
  await yearInput.pressSequentially("1820", { delay: 200 });
  await pause(page, 900);

  // ─── Mở phần Âm lịch ────────────────────────────────────────
  await narrate(
    page,
    "Tài liệu cũ ghi ngày Âm? Nhấn 'Nhập theo lịch Âm'.",
  );
  const lunarLink = page.getByRole("button", { name: "Nhập theo lịch Âm" });
  await highlight(lunarLink);
  await lunarLink.click();
  await pause(page, 700);

  await narrate(page, "Chuyển sang lịch Âm.");
  const lunarBtn = page.getByRole("button", { name: "Âm", exact: true });
  await highlight(lunarBtn);
  await lunarBtn.click();
  await pause(page, 700);

  // ─── Điền ngày tháng âm ─────────────────────────────────────
  await narrate(page, "Nhập tháng và ngày Âm.");
  const monthInput = page.locator("#birth-month");
  await highlight(monthInput);
  await monthInput.click();
  await monthInput.pressSequentially("5", { delay: 200 });
  await pause(page, 400);

  const dayInput = page.locator("#birth-day");
  await highlight(dayInput);
  await dayInput.click();
  await dayInput.pressSequentially("15", { delay: 200 });
  await pause(page, 1200);

  // ─── Can Chi ────────────────────────────────────────────────
  await narrate(
    page,
    "App tự hiện Can Chi của năm — vd. 'Canh Thìn' cho 1820.",
    { ms: 3000 },
  );

  await narrate(
    page,
    "Hoặc nhập trực tiếp Can Chi nếu chỉ nhớ tên năm.",
  );
  const canChiBtn = page.getByRole("button", {
    name: /Nhập theo can-chi/,
  });
  await highlight(canChiBtn);
  await canChiBtn.click();
  await pause(page, 1500);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Xong. App tự quy đổi Âm ↔ Dương và sinh ngày giỗ.",
    { ms: 2800 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
