import { test } from "@playwright/test";

import {
  clearCaption,
  createClanWithRoot,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #5 — Sửa thông tin, xoá người, và khôi phục từ Nhật ký.
 *
 * Demo soft-delete: dữ liệu không mất khi xoá, vẫn khôi phục được.
 */
test("05 — Sửa, xoá, khôi phục", async ({ page }) => {
  await login(page);
  const { clanId } = await createClanWithRoot(
    page,
    "Họ Demo — Sửa & Khôi phục",
    "Nguyễn Văn Tổ",
  );
  await pause(page, 800);

  await narrate(
    page,
    "Hướng dẫn: Sửa thông tin, xoá người, và khôi phục.",
    { ms: 2800 },
  );

  // ─── Sửa ────────────────────────────────────────────────────
  await narrate(page, "Bước 1 — Nhấn 'Sửa thông tin'.");
  const editBtn = page.getByTestId("edit-person-link");
  await highlight(editBtn);
  await editBtn.click();
  await page.waitForURL(/\/edit$/);
  await pause(page, 700);

  await narrate(page, "Đổi tên: thêm hậu tố ' (Cao Tằng Tổ)'.");
  const nameInput = page.getByTestId("edit-person-name-input");
  await highlight(nameInput);
  await nameInput.click();
  await nameInput.press("End");
  await nameInput.pressSequentially(" (Cao Tằng Tổ)", { delay: 110 });
  await pause(page, 600);

  const submitBtn = page.getByTestId("edit-person-submit-button");
  await highlight(submitBtn);
  await submitBtn.click();
  await page.waitForURL(/\/people\/[0-9a-f-]+$/, { timeout: 15_000 });
  await pause(page, 1500);

  // ─── Xoá ────────────────────────────────────────────────────
  await narrate(
    page,
    "Bước 2 — Lỡ xoá người? Khoá vẫn khôi phục được sau.",
  );
  const deleteBtn = page.getByTestId("delete-person-button");
  await highlight(deleteBtn);
  await deleteBtn.click();
  await pause(page, 900);

  await narrate(page, "Xác nhận xoá trong hộp thoại.");
  const confirmDelete = page.getByTestId("confirm-dialog-confirm");
  await highlight(confirmDelete);
  await confirmDelete.click();
  await page.waitForURL(/\/people$/, { timeout: 15_000 });
  await pause(page, 1500);

  // ─── Khôi phục từ Nhật ký ──────────────────────────────────
  await narrate(
    page,
    "Bước 3 — Mở 'Nhật ký' để khôi phục bản ghi vừa xoá.",
  );
  await page.goto(`/clans/${clanId}/audit`);
  await pause(page, 1500);

  await narrate(
    page,
    "Mục đầu là lần xoá vừa rồi. Nhấn 'Khôi phục'.",
  );
  const restoreBtn = page.getByTestId("audit-restore-button").first();
  await highlight(restoreBtn);
  await restoreBtn.click();
  await pause(page, 900);

  const confirmRestore = page.getByTestId("confirm-dialog-confirm");
  await highlight(confirmRestore);
  await confirmRestore.click();
  await pause(page, 2000);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Xong — người đã trở lại. Mọi thao tác đều có nhật ký.",
    { ms: 2800 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
