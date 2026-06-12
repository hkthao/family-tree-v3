import { test } from "@playwright/test";

import {
  clearCaption,
  hideSplash,
  highlight,
  login,
  narrate,
  pause,
  splash,
} from "./helpers";

/**
 * Video #0 — Tour giới thiệu app gia phả (~4 phút, mobile FullHD).
 *
 * Khác 19 video hướng dẫn từng tính năng: video này lướt qua các trang
 * gia phả chính (cây, person, xưng hô, đường trực hệ, sự kiện, gộp
 * trùng, thông gia, khôi phục, import, QR…) để người mới hiểu app làm
 * được gì. Cố tình không đi vào tính năng riêng của admin hệ thống.
 *
 * Yêu cầu:
 *   - `npm run db:reset && npm run seed` (small-admin@example.test có
 *     50 người + todo + posts + announcements)
 *   - `npm run dev` ở http://localhost:5173
 *
 * Chạy: `npm run videos -- --project=mobile-fullhd 00-overview`
 */
test("00 — Tour giới thiệu app gia phả", async ({ page }) => {
  test.setTimeout(360_000);

  // ─── Splash đầu video (3s) ──────────────────────────────────
  await page.goto("/login");
  await splash(page);
  await pause(page, 3000);
  // login() sẽ page.goto("/login") lại → DOM splash tự bay.

  // ─── Setup: login + lấy clan id ─────────────────────────────
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await pause(page, 1000);

  // ─── 1. Mở đầu ──────────────────────────────────────────────
  await narrate(
    page,
    "Đây là ứng dụng Gia phả Việt Nam — lưu giữ và lan toả dòng họ.",
    { ms: 4500 },
  );
  await narrate(
    page,
    "Một tài khoản có thể quản lý nhiều dòng họ riêng biệt.",
    { ms: 3800 },
  );
  await pause(page, 800);

  // ─── 2. Vào dashboard clan ──────────────────────────────────
  await narrate(page, "Mở một dòng họ để bắt đầu tham quan.", {
    ms: 2800,
  });
  await highlight(firstClan);
  await firstClan.click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+$/, { timeout: 10_000 });
  await pause(page, 1500);

  await narrate(
    page,
    "Trang tổng quan — số người, sự kiện sắp tới, lối tắt tới mọi chức năng.",
    { ms: 5000 },
  );
  await pause(page, 1200);

  // ─── 3. Cây gia phả ─────────────────────────────────────────
  await narrate(page, "Cây gia phả — trái tim của ứng dụng.", {
    ms: 2800,
  });
  await page.goto(`/clans/${clanId}/tree`);
  await page.locator(".f3 svg").first().waitFor({ timeout: 20_000 });
  await pause(page, 2000);

  await narrate(
    page,
    "Cây vẽ tự động — cha mẹ, vợ chồng, anh chị em nối đúng theo dữ liệu.",
    { ms: 5000 },
  );

  await narrate(page, "Phóng to để xem rõ từng người.");
  const zoomIn = page.getByTestId("tree-zoom-in");
  await highlight(zoomIn);
  await zoomIn.click();
  await pause(page, 700);
  await zoomIn.click();
  await pause(page, 1200);

  await narrate(page, "Gõ tên để đặt ai cũng vào trung tâm cây.");
  const searchInput = page.getByLabel("Đặt người trung tâm");
  await highlight(searchInput);
  await searchInput.click();
  await searchInput.pressSequentially("Văn", { delay: 200 });
  await pause(page, 1300);
  const firstMatch = page.locator("ul li button").first();
  await firstMatch.click();
  await pause(page, 2500);

  // ─── 4. Person Detail ───────────────────────────────────────
  await narrate(
    page,
    "Mỗi người có thẻ chi tiết — đầy đủ thông tin văn hoá Việt.",
    { ms: 4400 },
  );
  await page.goto(`/clans/${clanId}/people`);
  await pause(page, 1000);
  const firstPersonCard = page
    .locator('a[href*="/people/"]:not([href$="/new"])')
    .first();
  await firstPersonCard.click();
  await page.waitForURL(/\/people\/[0-9a-f-]+$/, { timeout: 10_000 });
  await pause(page, 1800);

  await narrate(
    page,
    "Ngày sinh có cả Dương lịch và Âm lịch — không lo lệch ngày giỗ.",
    { ms: 4800 },
  );
  await pause(page, 1200);

  await narrate(
    page,
    "Tên tiếng Việt đầy đủ: tên tự, tên hiệu, tên huý, tên thụy.",
    { ms: 4400 },
  );
  await pause(page, 1200);

  await narrate(
    page,
    "Vợ chồng, cha mẹ, con cái — mọi quan hệ về cùng một thẻ.",
    { ms: 4400 },
  );
  await pause(page, 1500);

  await narrate(
    page,
    "Nơi sinh, nơi an táng, ảnh thờ — cất giữ trọn vẹn ký ức.",
    { ms: 4600 },
  );
  await pause(page, 1500);

  // ─── 5. Xưng hô ─────────────────────────────────────────────
  await narrate(
    page,
    "App tự tính xưng hô — gọi ai là chú, là cô, là cháu họ ra sao.",
    { ms: 4800 },
  );
  await page.goto(`/clans/${clanId}/kinship`);
  await pause(page, 1500);

  await narrate(page, "Chọn hai người trong họ, app tính cách gọi tự động.");
  const pickerA = page.getByTestId("kinship-picker-a-input");
  await pickerA.click();
  await pickerA.pressSequentially("a", { delay: 150 });
  await pause(page, 1200);
  await page
    .locator("ul li button")
    .first()
    .click();
  await pause(page, 1000);

  const pickerB = page.getByTestId("kinship-picker-b-input");
  await pickerB.click();
  await pickerB.pressSequentially("a", { delay: 150 });
  await pause(page, 1200);
  await page
    .locator("ul li button")
    .nth(3)
    .click();
  await pause(page, 3500);

  // ─── 6. Đường trực hệ ───────────────────────────────────────
  await narrate(
    page,
    "Đường trực hệ — vẽ thẳng từ Thuỷ tổ xuống đến bạn.",
    { ms: 4200 },
  );
  await page.goto(`/clans/${clanId}/my-lineage`);
  await pause(page, 3000);

  // ─── 7. Sự kiện ─────────────────────────────────────────────
  await narrate(
    page,
    "Sự kiện gia tộc — giỗ tổ, họp họ, ngày kỷ niệm đều ghi vào đây.",
    { ms: 5000 },
  );
  await page.goto(`/clans/${clanId}/events`);
  await pause(page, 3200);

  // ─── 8. Hôm nay ─────────────────────────────────────────────
  await narrate(
    page,
    "Trang 'Hôm nay' nhắc giỗ, sinh nhật, ngày cưới của cả dòng họ.",
    { ms: 4800 },
  );
  await page.goto(`/clans/${clanId}/today`);
  await pause(page, 3000);

  // ─── 9. Việc cần làm ────────────────────────────────────────
  await narrate(
    page,
    "Việc cần làm — gợi ý hồ sơ còn thiếu để dòng họ ngày càng đầy đủ.",
    { ms: 4800 },
  );
  await page.goto(`/clans/${clanId}/todo`);
  await pause(page, 3000);

  // ─── 10. Gộp người trùng ───────────────────────────────────
  await narrate(
    page,
    "Gộp người trùng — nhập hai bản ghi của một người về một mối.",
    { ms: 4800 },
  );
  await page.goto(`/clans/${clanId}/merge`);
  await pause(page, 3200);

  // ─── 11. Thông gia ──────────────────────────────────────────
  await narrate(
    page,
    "Thông gia — kết nối dòng họ này với dòng họ khác qua hôn nhân.",
    { ms: 4600 },
  );
  await page.goto(`/clans/${clanId}/inlaws`);
  await pause(page, 3000);

  // ─── 12. Khôi phục / nhật ký ────────────────────────────────
  await narrate(
    page,
    "Nhật ký — lưu mọi thay đổi, lỡ tay sửa sai vẫn khôi phục được.",
    { ms: 5000 },
  );
  await page.goto(`/clans/${clanId}/audit`);
  await pause(page, 3000);

  // ─── 13. Đóng góp ───────────────────────────────────────────
  await narrate(
    page,
    "Người thân cùng đóng góp — mọi sửa đổi đều có lịch sử rõ ràng.",
    { ms: 4600 },
  );
  await page.goto(`/clans/${clanId}/contributions`);
  await pause(page, 3000);

  // ─── 14. Import Excel ───────────────────────────────────────
  await narrate(
    page,
    "Đã có gia phả Excel cũ? Tải mẫu, dán dữ liệu, nhập một lần là xong.",
    { ms: 5000 },
  );
  await page.goto(`/clans/${clanId}/import`);
  await pause(page, 3000);

  // ─── 15. Xuất QR cá nhân ────────────────────────────────────
  await narrate(
    page,
    "Xuất QR cá nhân — in dán vào gia phả giấy, quét là vào ngay thẻ.",
    { ms: 5000 },
  );
  await page.goto(`/clans/${clanId}/qr-export`);
  await pause(page, 3500);

  // ─── 16. Cài đặt dòng họ ────────────────────────────────────
  await narrate(
    page,
    "Cài đặt dòng họ — đặt tên, mô tả, ẩn/hiện người còn sống.",
    { ms: 4800 },
  );
  await page.goto(`/clans/${clanId}/settings`);
  await pause(page, 3000);

  // ─── 17. Kết ────────────────────────────────────────────────
  await page.goto(`/clans/${clanId}`);
  await pause(page, 1500);
  await narrate(
    page,
    "Mời bạn dùng thử và cùng giữ gìn dòng họ của mình.",
    { ms: 4200 },
  );
  await clearCaption(page);
  await pause(page, 400);

  // ─── Splash cuối video (3s) ─────────────────────────────────
  await splash(page);
  await pause(page, 3000);
  await hideSplash(page);
});
