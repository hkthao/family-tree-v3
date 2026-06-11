import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #1 — Tạo dòng họ đầu tiên (3 bước).
 *
 * Yêu cầu trước khi chạy:
 *   1. `npm run db:start` + `npm run db:reset` + `npm run seed`
 *      (tài khoản admin@example.test / demo-password-1234)
 *   2. `npm run dev` đang chạy ở http://localhost:5173
 *
 * Chạy: `npm run videos -- 01-tao-dong-ho`
 *
 * Output: webm trong `videos/_raw/.../video.webm`. Sau khi chạy xong,
 * dùng `npm run videos:rename` hoặc ffmpeg tay để đóng gói thành mp4.
 */
test("01 — Tạo dòng họ đầu tiên", async ({ page }) => {
  // ─── Mở đầu ─────────────────────────────────────────────────
  await login(page);
  await page.goto("/clans");
  await pause(page, 600);

  await narrate(
    page,
    "Hướng dẫn: Tạo dòng họ đầu tiên trong 3 bước.",
    { ms: 2200 },
  );

  // ─── Bước 1: mở form ────────────────────────────────────────
  await narrate(page, "Bước 1 — Nhấn nút 'Tạo dòng họ' ở góc phải.");
  const createBtn = page.getByTestId("create-clan-link");
  await highlight(createBtn);
  await createBtn.click();
  await page.waitForURL("**/clans/new");
  await pause(page, 600);

  // ─── Bước 2: điền tên + mô tả ──────────────────────────────
  await narrate(
    page,
    "Bước 2 — Đặt tên dòng họ. Có thể thêm mô tả (tuỳ chọn).",
  );
  const nameInput = page.getByTestId("clan-name-input");
  await highlight(nameInput);
  await nameInput.click();
  await nameInput.pressSequentially("Họ Demo Hướng Dẫn", { delay: 130 });
  await pause(page, 500);

  const descInput = page.getByTestId("clan-description-input");
  await highlight(descInput);
  await descInput.click();
  await descInput.pressSequentially(
    "Dòng họ minh hoạ cho video hướng dẫn",
    { delay: 100 },
  );
  await pause(page, 700);

  // ─── Bước 3: chọn chế độ + tạo ──────────────────────────────
  await narrate(
    page,
    "Bước 3 — Chọn chế độ hiển thị. Mặc định Riêng tư.",
  );
  await pause(page, 1200);

  await narrate(page, "Nhấn 'Tạo dòng họ' để hoàn tất.");
  const submitBtn = page.getByTestId("clan-submit-button");
  await highlight(submitBtn);
  await submitBtn.click();

  // Đợi điều hướng sang trang dòng họ mới.
  await page.waitForURL(/\/clans\/[0-9a-f-]+/, { timeout: 15_000 });
  await pause(page, 1200);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Xong! Bây giờ bạn có thể thêm Thuỷ tổ và xây dòng họ.",
    { ms: 2400 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
