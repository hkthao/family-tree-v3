import { test } from "@playwright/test";

import {
  clearCaption,
  enableSafeArea,
  hideSplash,
  highlight,
  login,
  narrate,
  navigateViaDrawer,
  pause,
  pinchZoom,
  scrollTour,
  splash,
} from "./helpers";

/**
 * Video #0 — Tour giới thiệu app gia phả (~5 phút, mobile FullHD).
 *
 * Khác 19 video hướng dẫn từng tính năng: video này lướt qua các trang
 * gia phả chính (cây, person, xưng hô, đường trực hệ, sự kiện, gộp
 * trùng, thông gia, khôi phục, import, QR…) để người mới hiểu app làm
 * được gì. Cố tình không đi vào tính năng riêng của admin hệ thống.
 *
 * V2 (bản này) — thay đổi so với V1:
 *   - Điều hướng qua menu trái thật (☰) thay vì page.goto("/clans/.../tree"),
 *     để dạy người xem THAO TÁC app, không phải nhảy tắt.
 *   - Cuộn xuống đáy + về đầu ở các trang dài (Today, Events, Person, …)
 *     để mobile thấy hết nội dung trong tầm 1 màn hình.
 *   - Bật vùng an toàn (safe area) cho phụ đề — chừa ~190px đáy → ≈380px
 *     ở 1080×1920 → không bị UI Reels/TikTok (avatar, like, share) che.
 *   - Zoom cây bằng pinch 2 ngón (hiện 2 chấm đỏ tách ra + dispatch
 *     wheel+ctrlKey vào d3.zoom) thay vì click nút +/−.
 *
 * Yêu cầu:
 *   - `npm run db:reset && npm run seed` (small-admin@example.test có
 *     50 người + todo + posts + announcements)
 *   - `npm run dev` ở http://localhost:5173
 *
 * Chạy: `npm run videos -- --project=mobile-fullhd 00-overview`
 */
test("00 — Tour giới thiệu app gia phả", async ({ page }) => {
  test.setTimeout(420_000);

  // ─── Splash đầu video (3s) ──────────────────────────────────
  await page.goto("/login");
  await enableSafeArea(page);
  await splash(page);
  await pause(page, 3000);
  // login() sẽ page.goto("/login") lại → DOM splash tự bay.

  // ─── Setup: login + lấy clan id ─────────────────────────────
  await login(page, "small-admin@example.test");
  await enableSafeArea(page); // bật lại — page.goto trong login() đã wipe window flag
  await page.goto("/clans");
  await enableSafeArea(page);
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
  await narrate(page, "Mở một dòng họ để bắt đầu tham quan.", { ms: 2800 });
  await highlight(firstClan);
  await firstClan.click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+$/, { timeout: 10_000 });
  await enableSafeArea(page);
  await pause(page, 1500);

  await narrate(
    page,
    "Trang tổng quan — số người, sự kiện sắp tới, lối tắt tới mọi chức năng.",
    { ms: 5000 },
  );
  // Dashboard có nhiều stat card + lối tắt — cuộn cho thấy hết.
  await scrollTour(page);
  await pause(page, 600);

  // ─── 3. Cây gia phả — qua menu, pinch zoom 2 ngón ────────────
  await narrate(page, "Bấm vào menu trái để mở các chức năng.", { ms: 3200 });
  await navigateViaDrawer(page, "Cây gia phả", /\/clans\/[0-9a-f-]+\/tree$/);
  await page.locator(".f3 svg").first().waitFor({ timeout: 20_000 });
  await pause(page, 1500);

  await narrate(page, "Cây gia phả — trái tim của ứng dụng.", { ms: 2800 });
  await narrate(
    page,
    "Cây vẽ tự động — cha mẹ, vợ chồng, anh chị em nối đúng theo dữ liệu.",
    { ms: 5000 },
  );

  await narrate(page, "Dùng 2 ngón tay chụm hoặc tách để thu/phóng cây.", {
    ms: 4000,
  });
  await pinchZoom(page, "in");
  await pause(page, 600);
  await pinchZoom(page, "in");
  await pause(page, 1000);

  await narrate(page, "Gõ tên để đặt ai cũng vào trung tâm cây.", { ms: 3600 });
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
  await navigateViaDrawer(page, "Danh bạ", /\/clans\/[0-9a-f-]+\/people$/);
  await pause(page, 1000);
  const firstPersonCard = page
    .locator('a[href*="/people/"]:not([href$="/new"])')
    .first();
  await firstPersonCard.click();
  await page.waitForURL(/\/people\/[0-9a-f-]+$/, { timeout: 10_000 });
  await pause(page, 1500);

  await narrate(
    page,
    "Ngày sinh có cả Dương lịch và Âm lịch — không lo lệch ngày giỗ.",
    { ms: 4800 },
  );
  await narrate(
    page,
    "Tên tiếng Việt đầy đủ: tên tự, tên hiệu, tên huý, tên thụy.",
    { ms: 4400 },
  );
  await narrate(
    page,
    "Vợ chồng, cha mẹ, con cái — mọi quan hệ về cùng một thẻ.",
    { ms: 4400 },
  );
  // Person Detail dài — cuộn cho thấy hết các section bên dưới.
  await scrollTour(page, { downMs: 2600, upMs: 1500 });
  await narrate(
    page,
    "Nơi sinh, nơi an táng, ảnh thờ — cất giữ trọn vẹn ký ức.",
    { ms: 4600 },
  );
  await pause(page, 800);

  // ─── 5. Xưng hô ─────────────────────────────────────────────
  await narrate(
    page,
    "App tự tính xưng hô — gọi ai là chú, là cô, là cháu họ ra sao.",
    { ms: 4800 },
  );
  await navigateViaDrawer(
    page,
    /Tra cứu xưng hô/,
    /\/clans\/[0-9a-f-]+\/kinship$/,
  );
  await pause(page, 1200);

  await narrate(page, "Chọn hai người trong họ, app tính cách gọi tự động.", {
    ms: 3800,
  });
  const pickerA = page.getByTestId("kinship-picker-a-input");
  await pickerA.click();
  await pickerA.pressSequentially("a", { delay: 150 });
  await pause(page, 1200);
  await page.locator("ul li button").first().click();
  await pause(page, 1000);

  const pickerB = page.getByTestId("kinship-picker-b-input");
  await pickerB.click();
  await pickerB.pressSequentially("a", { delay: 150 });
  await pause(page, 1200);
  await page.locator("ul li button").nth(3).click();
  await pause(page, 3500);

  // ─── 6. Đường trực hệ ───────────────────────────────────────
  await narrate(
    page,
    "Đường trực hệ — vẽ thẳng từ Thuỷ tổ xuống đến bạn.",
    { ms: 4200 },
  );
  await navigateViaDrawer(
    page,
    "Đường trực hệ",
    /\/clans\/[0-9a-f-]+\/my-lineage$/,
  );
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 7. Sự kiện ─────────────────────────────────────────────
  await narrate(
    page,
    "Sự kiện gia tộc — giỗ tổ, họp họ, ngày kỷ niệm đều ghi vào đây.",
    { ms: 5000 },
  );
  await navigateViaDrawer(page, "Sự kiện", /\/clans\/[0-9a-f-]+\/events$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 8. Hôm nay ─────────────────────────────────────────────
  await narrate(
    page,
    "Trang 'Hôm nay' nhắc giỗ, sinh nhật, ngày cưới của cả dòng họ.",
    { ms: 4800 },
  );
  await navigateViaDrawer(page, "Hôm nay", /\/clans\/[0-9a-f-]+\/today$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 9. Việc cần làm ────────────────────────────────────────
  await narrate(
    page,
    "Việc cần làm — gợi ý hồ sơ còn thiếu để dòng họ ngày càng đầy đủ.",
    { ms: 4800 },
  );
  await navigateViaDrawer(page, "Việc cần làm", /\/clans\/[0-9a-f-]+\/todo$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 10. Gộp người trùng ───────────────────────────────────
  await narrate(
    page,
    "Gộp người trùng — nhập hai bản ghi của một người về một mối.",
    { ms: 4800 },
  );
  await navigateViaDrawer(
    page,
    "Gộp người trùng",
    /\/clans\/[0-9a-f-]+\/merge$/,
  );
  await pause(page, 2500);

  // ─── 11. Thông gia ──────────────────────────────────────────
  await narrate(
    page,
    "Thông gia — kết nối dòng họ này với dòng họ khác qua hôn nhân.",
    { ms: 4600 },
  );
  await navigateViaDrawer(
    page,
    /Liên kết thông gia/,
    /\/clans\/[0-9a-f-]+\/inlaws$/,
  );
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 12. Khôi phục / nhật ký ────────────────────────────────
  await narrate(
    page,
    "Nhật ký — lưu mọi thay đổi, lỡ tay sửa sai vẫn khôi phục được.",
    { ms: 5000 },
  );
  await navigateViaDrawer(page, "Nhật ký", /\/clans\/[0-9a-f-]+\/audit$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 13. Đóng góp ───────────────────────────────────────────
  await narrate(
    page,
    "Người thân cùng đóng góp — mọi sửa đổi đều có lịch sử rõ ràng.",
    { ms: 4600 },
  );
  await navigateViaDrawer(
    page,
    "Đóng góp",
    /\/clans\/[0-9a-f-]+\/contributions$/,
  );
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 14. Import Excel ───────────────────────────────────────
  await narrate(
    page,
    "Đã có gia phả Excel cũ? Tải mẫu, dán dữ liệu, nhập một lần là xong.",
    { ms: 5000 },
  );
  await navigateViaDrawer(
    page,
    /Nhập từ Excel/,
    /\/clans\/[0-9a-f-]+\/import$/,
  );
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 15. Xuất QR cá nhân ────────────────────────────────────
  await narrate(
    page,
    "Xuất QR cá nhân — in dán vào gia phả giấy, quét là vào ngay thẻ.",
    { ms: 5000 },
  );
  await navigateViaDrawer(
    page,
    /Xuất QR cá nhân/,
    /\/clans\/[0-9a-f-]+\/qr-export$/,
  );
  await pause(page, 2500);

  // ─── 16. Cài đặt dòng họ ────────────────────────────────────
  await narrate(
    page,
    "Cài đặt dòng họ — đặt tên, mô tả, ẩn/hiện người còn sống.",
    { ms: 4800 },
  );
  await navigateViaDrawer(
    page,
    /Cài đặt dòng họ/,
    /\/clans\/[0-9a-f-]+\/settings$/,
  );
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 17. Kết ────────────────────────────────────────────────
  await navigateViaDrawer(page, "Tổng quan", /\/clans\/[0-9a-f-]+$/);
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
