import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #12 — Gộp người trùng.
 *
 * Demo flow nhưng KHÔNG bấm "Gộp" cuối — tránh phá dữ liệu seed cho
 * các lần chạy sau.
 */
test("12 — Gộp người trùng", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/merge`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1500);

  await narrate(
    page,
    "Hướng dẫn: Khi 2 dòng dữ liệu cùng 1 người — gộp lại còn một.",
    { ms: 3200 },
  );

  // ─── Chọn "Giữ lại" ─────────────────────────────────────────
  await narrate(
    page,
    "Bước 1 — Chọn người 'Giữ lại' (bản gốc).",
  );
  const winnerInput = page.getByTestId("merge-picker-winner-input");
  await highlight(winnerInput);
  await winnerInput.click();
  await winnerInput.pressSequentially("Văn", { delay: 180 });
  await pause(page, 1000);

  const winnerFirst = page.locator("ul li button").first();
  await highlight(winnerFirst);
  await winnerFirst.click();
  await pause(page, 1500);

  // ─── Chọn "Gộp vào" ─────────────────────────────────────────
  await narrate(
    page,
    "Bước 2 — Chọn người 'Gộp vào' (bản trùng — sẽ bị gộp).",
  );
  const loserInput = page.getByTestId("merge-picker-loser-input");
  await highlight(loserInput);
  await loserInput.click();
  await loserInput.pressSequentially("Văn", { delay: 180 });
  await pause(page, 1000);

  // Lấy người thứ hai (khác người đã chọn ở winner).
  const loserSecond = page.locator("ul li button").nth(1);
  await highlight(loserSecond);
  await loserSecond.click();
  await pause(page, 1800);

  // ─── So sánh ────────────────────────────────────────────────
  await narrate(
    page,
    "Bảng so sánh hiện cả hai bên — chọn giá trị nào sẽ ưu tiên.",
    { ms: 3400 },
  );

  await page.evaluate(() => window.scrollBy({ top: 250, behavior: "smooth" }));
  await pause(page, 1800);

  // ─── Kết — KHÔNG bấm Gộp ────────────────────────────────────
  await narrate(
    page,
    "Bấm 'Gộp' để hoàn tất. Có thể khôi phục từ nhật ký nếu sai.",
    { ms: 3200 },
  );

  const mergeBtn = page.getByRole("button", { name: /^Gộp$/ }).first();
  await highlight(mergeBtn);
  // Demo dừng tại đây — không bấm để giữ dữ liệu seed nguyên vẹn.
  await pause(page, 800);

  await clearCaption(page);
  await pause(page, 400);
});
