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
  viewPdfFile,
} from "./helpers";

/**
 * Video #0 — Tour giới thiệu app gia phả (~7 phút, mobile FullHD).
 *
 * Khác 19 video hướng dẫn từng tính năng: video này lướt qua các trang
 * gia phả chính (cây, person, đường trực hệ, sự kiện, gộp trùng,
 * thông gia, khôi phục, import, QR…) để người mới hiểu app làm được
 * gì. Cố tình không đi vào tính năng riêng của admin hệ thống.
 *
 * Thứ tự được sắp lại — chức năng người dùng làm THƯỜNG XUYÊN nằm
 * ngay đầu video (đoạn 60s đầu là đoạn được xem nhiều nhất trên
 * Reels/TikTok):
 *   1. Tạo dòng họ mới
 *   2. Thêm người (contact) mới
 *   3. Thêm sự kiện mới
 *   4. Xuất sổ gia phả PDF + xem lại file PDF
 *
 * Phần overview các tính năng khác (cây, person detail, đường trực hệ,
 * sự kiện, hôm nay, todo, gộp, thông gia, audit, đóng góp, import, QR,
 * cài đặt) ở nửa sau — ai xem hết thì tốt, ai bỏ ngang vẫn nắm được
 * 4 thao tác quan trọng nhất.
 *
 * Đã bỏ phần "Tra cứu xưng hô" — chức năng phụ, người dùng tự khám
 * phá khi cần.
 *
 * Yêu cầu:
 *   - `npm run db:reset && npm run seed` (small-admin@example.test có
 *     50 người + todo + posts + announcements)
 *   - `npm run dev` ở http://localhost:5173
 *
 * Chạy: `npm run videos -- --project=mobile-fullhd 00-overview`
 */
test("00 — Tour giới thiệu app gia phả", async ({ page }) => {
  // ~10-12 phút thực + biên an toàn. Spec dài hơn 19 video khác vì
  // gộp 4 flow tạo mới + xuất PDF + tour 13 tính năng vào 1 video.
  test.setTimeout(1_500_000);

  // Bật dark theme TRƯỚC khi mọi page load — lib/theme.ts đọc
  // localStorage key này khi initTheme() chạy từ main.tsx và toggle
  // class .dark trên <html>. addInitScript chạy trên mọi navigation.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("family-tree:theme", "dark");
    } catch {
      /* private mode — bỏ qua */
    }
  });

  // ─── Splash đầu video (3s) ──────────────────────────────────
  await page.goto("/login");
  await enableSafeArea(page);
  await splash(page);
  await pause(page, 3000);
  // login() sẽ page.goto("/login") lại → DOM splash tự bay.

  // ─── Setup: login ───────────────────────────────────────────
  // Dùng admin@example.test (platform admin, maxClans=10) — small-admin
  // mặc định chỉ tạo được 1 dòng họ nên sẽ vướng "max_clans limit" khi
  // demo flow Tạo dòng họ mới.
  await login(page, "admin@example.test");
  await enableSafeArea(page);

  // ─── 1. Mở đầu ──────────────────────────────────────────────
  await narrate(
    page,
    "Đây là ứng dụng Dòng Họ Việt Việt Nam — lưu giữ và lan toả dòng họ.",
    { ms: 4500 },
  );
  await narrate(
    page,
    "Mình lướt qua bốn việc bạn sẽ làm thường xuyên trước.",
    { ms: 4200 },
  );

  // ─── 2. TẠO DÒNG HỌ MỚI ────────────────────────────────────
  await narrate(
    page,
    "Việc đầu tiên: tạo dòng họ. Một tài khoản quản lý được nhiều dòng họ.",
    { ms: 4800 },
  );
  await page.goto("/clans");
  await enableSafeArea(page);
  await pause(page, 1000);
  const createClanLink = page.getByTestId("create-clan-link");
  await highlight(createClanLink);
  await createClanLink.click();
  await page.waitForURL("**/clans/new", { timeout: 10_000 });
  await enableSafeArea(page);
  await pause(page, 1200);

  await narrate(page, "Đặt tên dòng họ — chỉ cần một dòng.", { ms: 3500 });
  const clanNameInput = page.getByTestId("clan-name-input");
  await highlight(clanNameInput);
  // .fill() instant — pressSequentially Tiếng Việt + slowMo 700ms/key
  // gây hang nhiều phút trên một số keystroke có dấu.
  await clanNameInput.fill("Họ Demo Tour");
  await pause(page, 1200);

  const clanDescInput = page.getByTestId("clan-description-input");
  await clanDescInput.fill("Dòng họ thử nghiệm");
  await pause(page, 1000);

  const clanSubmit = page.getByTestId("clan-submit-button");
  await highlight(clanSubmit);
  await clanSubmit.click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+$/, { timeout: 10_000 });
  await enableSafeArea(page);
  const clanUrl = page.url();
  const demoClanId = clanUrl.match(/\/clans\/([0-9a-f-]+)$/)?.[1] ?? "";
  await pause(page, 1500);
  await narrate(
    page,
    "Xong — dòng họ mới đã sẵn sàng, hiển thị trang Tổng quan.",
    { ms: 4200 },
  );

  // ─── 3. THÊM NGƯỜI MỚI ─────────────────────────────────────
  await narrate(
    page,
    "Việc thứ hai: thêm Thuỷ tổ — người đầu tiên trong dòng họ.",
    { ms: 4600 },
  );
  // Dashboard cho clan rỗng hiển thị VideoEmptyState với CTA
  // "Thêm Thuỷ tổ" → /people/new. Khi clan có người rồi sẽ là
  // ActionTile "Thêm người". Cả hai đều href="/people/new" nên match
  // bằng URL gọn nhất.
  const addPersonTile = page.locator('a[href$="/people/new"]').first();
  await highlight(addPersonTile);
  await addPersonTile.click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+\/people\/new$/, {
    timeout: 10_000,
  });
  await enableSafeArea(page);
  await pause(page, 1200);

  await narrate(page, "Họ và tên — bắt buộc.", { ms: 2400 });
  const personName = page.getByTestId("person-name-input");
  await highlight(personName);
  await personName.fill("Lê Văn Tổ");
  await pause(page, 1000);

  await narrate(
    page,
    "Người đầu tiên trong họ — đánh dấu là Thuỷ tổ.",
    { ms: 4000 },
  );
  const rootCb = page.getByTestId("person-is-root-checkbox");
  await highlight(rootCb);
  await rootCb.check();
  await pause(page, 800);

  const personSubmit = page.getByTestId("person-submit-button");
  await highlight(personSubmit);
  await personSubmit.click();
  await page.waitForURL(/\/people$|\/people\/[0-9a-f-]+$/, {
    timeout: 12_000,
  });
  await enableSafeArea(page);
  await pause(page, 1500);
  await narrate(
    page,
    "Đã có một người trong dòng họ. Thêm vợ/chồng, con cái cũng cùng cách.",
    { ms: 4800 },
  );

  // ─── 4. THÊM SỰ KIỆN MỚI ───────────────────────────────────
  await narrate(
    page,
    "Việc thứ ba: ghi sự kiện gia tộc — họp họ, kỷ niệm, ngày giỗ.",
    { ms: 4800 },
  );
  await navigateViaDrawer(page, "Sự kiện", /\/clans\/[0-9a-f-]+\/events$/);
  await pause(page, 1200);

  // Có nút "Thêm sự kiện" mở form inline.
  const openEventForm = page.getByRole("button", { name: /Thêm sự kiện/ });
  await highlight(openEventForm);
  await openEventForm.click();
  await pause(page, 800);

  const evtTitle = page.locator("#evt-title");
  await highlight(evtTitle);
  await evtTitle.fill("Họp họ đầu xuân");
  await pause(page, 800);

  await narrate(
    page,
    "Ghi theo Dương lịch hoặc Âm lịch — chọn ngày là xong.",
    { ms: 4200 },
  );
  const evtSolar = page.locator("#evt-solar");
  await evtSolar.fill("2026-02-15");
  await pause(page, 1000);

  // Submit nút trong form — lấy duy nhất `button[type=submit]` trong
  // form chứa #evt-title (tránh trùng với nút toggle "Thêm sự kiện"
  // ngoài form).
  const evtSubmit = page
    .locator("form", { has: page.locator("#evt-title") })
    .locator('button[type="submit"]');
  await highlight(evtSubmit);
  await evtSubmit.click();
  await pause(page, 2500);
  await narrate(page, "Sự kiện đã được lưu vào lịch của dòng họ.", {
    ms: 3800,
  });

  // ─── 5. CHUYỂN SANG DÒNG HỌ CÓ NHIỀU NGƯỜI ─────────────────
  // Để demo Xuất PDF cho ra sổ gia phả nhiều trang (clan Demo Tour
  // vừa tạo chỉ 1 người → PDF cũn cỡn). Admin platform-admin không
  // sở hữu clan seed nào → sang tab Cộng đồng chọn 1 clan công khai
  // 50-100 người.
  await narrate(
    page,
    "Giờ mở một dòng họ nhiều thành viên để xem các tính năng còn lại.",
    { ms: 4800 },
  );
  await page.goto("/clans");
  await enableSafeArea(page);
  await pause(page, 1200);
  // TabButton render `<button role="tab">` (Clans.tsx).
  const communityTab = page.getByRole("tab", { name: /Cộng đồng/ });
  await highlight(communityTab);
  await communityTab.click();
  await pause(page, 2000);

  const seededClan = page
    .locator(`main a[href^="/clans/"]:not([href="/clans/new"]):not([href="/clans/${demoClanId}"])`)
    .first();
  await seededClan.waitFor({ state: "visible", timeout: 10_000 });
  await highlight(seededClan);
  await seededClan.click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+$/, { timeout: 10_000 });
  await enableSafeArea(page);
  const clanId = page.url().match(/\/clans\/([0-9a-f-]+)$/)?.[1] ?? "";
  await pause(page, 1500);

  await narrate(
    page,
    "Trang tổng quan — số người, sự kiện sắp tới, lối tắt mọi chức năng.",
    { ms: 4800 },
  );
  await scrollTour(page);
  await pause(page, 600);

  // ─── 6. XUẤT SỔ GIA PHẢ PDF (trên clan nhiều người) ────────
  await narrate(
    page,
    "Việc thứ tư: xuất sổ gia phả ra PDF — đầy đủ tất cả thành viên.",
    { ms: 5000 },
  );
  const exportBtn = page.getByRole("button", { name: /Xuất PDF/ });
  await highlight(exportBtn);
  await narrate(page, "Bấm 'Xuất PDF' — app dựng file, chờ vài giây.", {
    ms: 4000,
  });
  // PDF cho clan 50-100 người có thể mất 20-40s render.
  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await exportBtn.click();
  const download = await downloadPromise;
  const tmpPath = `/tmp/ft-tour-${Date.now()}.pdf`;
  await download.saveAs(tmpPath);
  await pause(page, 1500);

  await narrate(
    page,
    "File đã tải xong — lật từng trang sổ gia phả luôn.",
    { ms: 4000 },
  );
  // Chiếu nhiều trang chậm: 4.5s/trang × tối đa 8 trang ≈ 36s.
  await viewPdfFile(page, tmpPath, { perPageMs: 4500, maxPages: 8 });
  await narrate(
    page,
    "Sổ gia phả PDF — có thể in, gửi qua Zalo hoặc lưu trên cloud.",
    { ms: 4500 },
  );

  // ─── 7. Cây gia phả — pinch zoom ────────────────────────────
  await narrate(page, "Mở menu trái để vào Cây gia phả.", { ms: 3000 });
  await navigateViaDrawer(page, "Cây gia phả", /\/clans\/[0-9a-f-]+\/tree$/);
  await page.locator(".f3 svg").first().waitFor({ timeout: 20_000 });
  await pause(page, 1500);

  await narrate(page, "Cây vẽ tự động theo dữ liệu — đầy đủ cha mẹ, con cái.", {
    ms: 4500,
  });
  await narrate(page, "Dùng 2 ngón tay chụm hoặc tách để thu/phóng cây.", {
    ms: 4000,
  });
  await pinchZoom(page, "in");
  await pause(page, 600);
  await pinchZoom(page, "in");
  await pause(page, 1000);

  await narrate(page, "Gõ tên để đặt ai cũng vào trung tâm cây.", {
    ms: 3600,
  });
  const searchInput = page.getByLabel("Đặt người trung tâm");
  await highlight(searchInput);
  await searchInput.click();
  await searchInput.pressSequentially("Văn", { delay: 200 });
  await pause(page, 1300);
  const firstMatch = page.locator("ul li button").first();
  await firstMatch.click();
  await pause(page, 2500);

  // ─── 8. Person Detail ───────────────────────────────────────
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
    "Ngày sinh Dương + Âm, tên tự/hiệu/huý/thụy, quan hệ vợ chồng cha mẹ con cái.",
    { ms: 5200 },
  );
  await scrollTour(page);
  await narrate(
    page,
    "Nơi sinh, nơi an táng, ảnh thờ — đầy đủ thông tin văn hoá Việt.",
    { ms: 4600 },
  );

  // ─── 9. Đường trực hệ ───────────────────────────────────────
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

  // ─── 10. Sự kiện (xem lịch dòng họ) ─────────────────────────
  await narrate(
    page,
    "Sự kiện gia tộc — giỗ tổ, họp họ, ngày kỷ niệm đều ở đây.",
    { ms: 4800 },
  );
  await navigateViaDrawer(page, "Sự kiện", /\/clans\/[0-9a-f-]+\/events$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 11. Hôm nay ────────────────────────────────────────────
  await narrate(
    page,
    "Trang 'Hôm nay' nhắc giỗ, sinh nhật, ngày cưới của cả dòng họ.",
    { ms: 4800 },
  );
  await navigateViaDrawer(page, "Hôm nay", /\/clans\/[0-9a-f-]+\/today$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 12. Việc cần làm ───────────────────────────────────────
  await narrate(
    page,
    "Việc cần làm — gợi ý hồ sơ còn thiếu để dòng họ ngày càng đầy đủ.",
    { ms: 4800 },
  );
  await navigateViaDrawer(page, "Việc cần làm", /\/clans\/[0-9a-f-]+\/todo$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 13. Gộp người trùng ───────────────────────────────────
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

  // ─── 14. Thông gia ─────────────────────────────────────────
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

  // ─── 15. Nhật ký / khôi phục ───────────────────────────────
  await narrate(
    page,
    "Nhật ký — lưu mọi thay đổi, lỡ tay sửa sai vẫn khôi phục được.",
    { ms: 5000 },
  );
  await navigateViaDrawer(page, "Nhật ký", /\/clans\/[0-9a-f-]+\/audit$/);
  await pause(page, 1500);
  await scrollTour(page);

  // ─── 16. Đóng góp ──────────────────────────────────────────
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

  // ─── 17. Import Excel ──────────────────────────────────────
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

  // ─── 18. QR cá nhân ────────────────────────────────────────
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

  // ─── 19. Cài đặt ───────────────────────────────────────────
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

  // ─── 20. Kết ───────────────────────────────────────────────
  await navigateViaDrawer(page, "Tổng quan", /\/clans\/[0-9a-f-]+$/);
  await pause(page, 1500);
  await narrate(
    page,
    "Bốn việc thường xuyên: tạo dòng họ, thêm người, ghi sự kiện, xuất PDF.",
    { ms: 5200 },
  );
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

  // Reference clanId để bypass TS unused-variable lint nếu cần — clanId
  // được lấy ở Section 6 nhưng không dùng trực tiếp vì điều hướng chính
  // qua drawer. Giữ để debugging.
  void clanId;
});
