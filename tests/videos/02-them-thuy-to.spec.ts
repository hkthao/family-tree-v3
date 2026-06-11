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
 * Video #2 — Thêm Thuỷ tổ (đời 1).
 *
 * Tiền đề: tài khoản đã có sẵn (qua seed) và Supabase local đang chạy.
 * Video tự tạo 1 dòng họ rỗng để demo — không phụ thuộc trạng thái
 * trước đó.
 *
 * Chạy: `npm run videos -- 02-them-thuy-to`
 */
test("02 — Thêm Thuỷ tổ", async ({ page }) => {
  // ─── Setup im lặng (không narrate) ──────────────────────────
  await login(page);
  await createEmptyClan(page, "Họ Demo — Thuỷ tổ");
  await pause(page, 800);

  // ─── Mở đầu ─────────────────────────────────────────────────
  await narrate(
    page,
    "Hướng dẫn: Thêm Thuỷ tổ — người đầu tiên, đời 1 của dòng họ.",
    { ms: 2800 },
  );

  // ─── Bước 1: mở form ────────────────────────────────────────
  await narrate(
    page,
    "Bước 1 — Trên trang dòng họ trống, nhấn 'Thêm người'.",
  );
  const addBtn = page.getByTestId("dashboard-add-person-link");
  await highlight(addBtn);
  await addBtn.click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+\/people\/new$/);
  await pause(page, 600);

  // ─── Bước 2: họ tên ────────────────────────────────────────
  await narrate(page, "Bước 2 — Nhập họ tên đầy đủ.");
  const nameInput = page.getByTestId("person-name-input");
  await highlight(nameInput);
  await nameInput.click();
  await nameInput.pressSequentially("Nguyễn Văn Tổ", { delay: 130 });
  await pause(page, 500);

  // ─── Bước 3: giới tính + năm sinh ──────────────────────────
  await narrate(
    page,
    "Bước 3 — Chọn giới tính. Nam là mặc định.",
    { ms: 2200 },
  );

  await narrate(
    page,
    "Bước 4 — Nhập năm sinh. Chỉ nhớ năm cũng được, bỏ trống ngày/tháng.",
  );
  const yearInput = page.getByTestId("birth-year-input");
  await highlight(yearInput);
  await yearInput.click();
  await yearInput.pressSequentially("1850", { delay: 200 });
  await pause(page, 700);

  // ─── Bước 5: tick Thuỷ tổ ───────────────────────────────────
  await narrate(
    page,
    "Bước 5 — Đánh dấu 'Thuỷ tổ'. Đây là gốc của dòng họ.",
  );
  const rootCheckbox = page.getByTestId("person-is-root-checkbox");
  await highlight(rootCheckbox);
  await rootCheckbox.check();
  await pause(page, 900);

  // ─── Bước 6: lưu ────────────────────────────────────────────
  await narrate(page, "Bước 6 — Nhấn 'Lưu' để hoàn tất.");
  const submitBtn = page.getByTestId("person-submit-button");
  await highlight(submitBtn);
  await submitBtn.click();

  // Sau khi lưu, app điều hướng về trang danh sách người.
  await page.waitForURL(/\/clans\/[0-9a-f-]+\/people$/, { timeout: 15_000 });
  await pause(page, 1500);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Xong! Thuỷ tổ đã có. Tiếp theo: thêm vợ/chồng và con.",
    { ms: 2800 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
