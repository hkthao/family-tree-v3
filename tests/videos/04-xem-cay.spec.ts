import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #4 — Xem cây gia phả (zoom + đặt người trung tâm).
 *
 * Dùng clan 50 người sẵn từ seed (small-admin@example.test) để có cây
 * đủ phong phú để demo zoom/pan/đổi gốc.
 */
test("04 — Xem cây gia phả", async ({ page }) => {
  // ─── Setup im lặng ──────────────────────────────────────────
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/tree`);
  // Chờ cây render xong — family-chart vẽ SVG vào container .f3.
  await page.locator(".f3 svg").first().waitFor({ timeout: 20_000 });
  await pause(page, 2000);

  await narrate(
    page,
    "Hướng dẫn: Cây gia phả — zoom, đặt người trung tâm.",
    { ms: 2800 },
  );

  // ─── Zoom in ────────────────────────────────────────────────
  await narrate(page, "Nhấn '+' để phóng to cây.");
  const zoomIn = page.getByTestId("tree-zoom-in");
  await highlight(zoomIn);
  await zoomIn.click();
  await pause(page, 700);
  await zoomIn.click();
  await pause(page, 1000);

  // ─── Zoom out ───────────────────────────────────────────────
  await narrate(page, "Nhấn '−' để thu nhỏ.");
  const zoomOut = page.getByTestId("tree-zoom-out");
  await highlight(zoomOut);
  await zoomOut.click();
  await pause(page, 1200);

  // ─── Search focal ───────────────────────────────────────────
  await narrate(
    page,
    "Gõ tên vào ô tìm để đặt người đó vào trung tâm.",
  );
  const searchInput = page.getByLabel("Đặt người trung tâm");
  await highlight(searchInput);
  await searchInput.click();
  // "Văn" là tên đệm nam phổ biến — chắc chắn match nhiều người.
  await searchInput.pressSequentially("Văn", { delay: 200 });
  await pause(page, 1200);

  // Click kết quả đầu tiên trong dropdown.
  const firstMatch = page.locator("ul li button").first();
  await highlight(firstMatch);
  await firstMatch.click();
  await pause(page, 2000);

  // ─── Về Thuỷ tổ ─────────────────────────────────────────────
  await narrate(
    page,
    "Nhấn 'Về Thuỷ tổ' để quay lại gốc dòng họ.",
  );
  const homeBtn = page.getByRole("button", { name: /Về Thuỷ tổ/ });
  await highlight(homeBtn);
  await homeBtn.click();
  await pause(page, 2000);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Xong — bạn đã biết cách di chuyển trong cây gia phả.",
    { ms: 2600 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
