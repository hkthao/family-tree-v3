import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #14 — Vai trò trong dòng họ (Admin / Editor / Viewer).
 *
 * Demo trang Thành viên: mời thêm + chọn vai trò. KHÔNG bấm 'Mời' để
 * không nhả invite rác.
 */
test("14 — Vai trò thành viên", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/members`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1500);

  await narrate(
    page,
    "Hướng dẫn: 3 vai trò — Quản trị, Biên tập, Xem.",
    { ms: 2800 },
  );

  await narrate(
    page,
    "Quản trị: toàn quyền. Biên tập: sửa dữ liệu. Xem: chỉ xem.",
    { ms: 3400 },
  );

  // ─── Mời thành viên ─────────────────────────────────────────
  await narrate(page, "Để mời người mới, gõ email họ.");
  const emailInput = page.locator("#invite_email");
  await highlight(emailInput);
  await emailInput.click();
  await emailInput.pressSequentially("nguoithan@example.com", { delay: 130 });
  await pause(page, 800);

  await narrate(page, "Chọn vai trò phù hợp.");
  // Radio "Biên tập" trong form mời — text này còn xuất hiện ở danh
  // sách thành viên, dùng scope qua form để tránh ambiguous.
  const editorRadio = page
    .locator("form")
    .getByText("Biên tập", { exact: true });
  await highlight(editorRadio);
  await editorRadio.click();
  await pause(page, 1200);

  await narrate(
    page,
    "Bấm 'Mời' để gửi. Người đó cần đã có tài khoản từ trước.",
    { ms: 3200 },
  );
  const inviteBtn = page.getByRole("button", { name: /^Mời$/ });
  await highlight(inviteBtn);
  // Không bấm.
  await pause(page, 800);

  // ─── Danh sách thành viên ──────────────────────────────────
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await pause(page, 1500);

  await narrate(
    page,
    "Danh sách bên dưới — đổi vai trò hoặc gỡ thành viên ở đây.",
    { ms: 3000 },
  );

  await clearCaption(page);
  await pause(page, 400);
});
