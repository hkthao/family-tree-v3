import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #13 — Đăng nhập: magic link qua email + QR sang điện thoại.
 *
 * KHÔNG dùng helper login() — video này demo trang đăng nhập, phải
 * đang ở trạng thái chưa đăng nhập.
 */
test("13 — Đăng nhập", async ({ page }) => {
  await page.goto("/login");
  await pause(page, 1200);

  await narrate(
    page,
    "Hướng dẫn: 2 cách đăng nhập — magic link qua email và QR.",
    { ms: 3200 },
  );

  // ─── Magic link ─────────────────────────────────────────────
  await narrate(
    page,
    "Cách 1 — Magic link: nhấn 'Đăng nhập bằng liên kết qua email'.",
  );
  const switchToMagic = page.getByRole("button", {
    name: "Đăng nhập bằng liên kết qua email",
  });
  await highlight(switchToMagic);
  await switchToMagic.click();
  await pause(page, 900);

  await narrate(page, "Nhập email rồi nhấn 'Gửi liên kết qua email'.");
  const emailInput = page.getByLabel("Email");
  await highlight(emailInput);
  await emailInput.click();
  await emailInput.pressSequentially("ban@example.com", { delay: 130 });
  await pause(page, 700);

  // KHÔNG bấm gửi thật để khỏi nhả email rác từ Supabase local.
  const sendBtn = page.getByRole("button", {
    name: /Gửi liên kết qua email/,
  });
  await highlight(sendBtn);
  await pause(page, 1500);

  // ─── Quay về password mode ──────────────────────────────────
  const backToPwd = page.getByRole("button", { name: "Dùng mật khẩu" });
  await backToPwd.click();
  await pause(page, 800);

  // ─── QR đăng nhập nhanh ─────────────────────────────────────
  await narrate(
    page,
    "Cách 2 — Đã đăng nhập trên máy khác? Quét QR để sang nhanh điện thoại.",
    { ms: 3600 },
  );
  const qrBtn = page.getByRole("button", {
    name: /Đăng nhập nhanh \(quét mã QR\)/,
  });
  await highlight(qrBtn);
  await qrBtn.click();
  await pause(page, 2500);

  // Đóng modal bằng Escape.
  await page.keyboard.press("Escape");
  await pause(page, 800);

  await narrate(
    page,
    "Xong — bạn đã biết cả 2 cách. Có thể tạo QR ở 'Tài khoản'.",
    { ms: 3000 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
