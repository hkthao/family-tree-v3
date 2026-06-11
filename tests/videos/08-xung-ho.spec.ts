import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #8 — Tra cứu xưng hô giữa 2 người trong dòng họ.
 *
 * Dùng clan 50 người của small-admin để có sẵn các quan hệ.
 */
test("08 — Tra cứu xưng hô", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/kinship`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1500);

  await narrate(
    page,
    "Hướng dẫn: Tra cứu xưng hô — chọn 2 người, app tính theo phong tục Việt.",
    { ms: 3400 },
  );

  // ─── Chọn người A ───────────────────────────────────────────
  await narrate(page, "Bước 1 — Chọn 'Người A' từ danh sách.");
  const pickerA = page.getByTestId("kinship-picker-a-input");
  await highlight(pickerA);
  // Click người đầu tiên trong danh sách (thường là Thuỷ tổ hoặc gần gốc).
  const firstA = pickerA.locator("..").locator("ul li button").first();
  await highlight(firstA);
  await firstA.click();
  await pause(page, 1000);

  // ─── Chọn người B ───────────────────────────────────────────
  await narrate(page, "Bước 2 — Chọn 'Người B' (người khác).");
  const pickerB = page.getByTestId("kinship-picker-b-input");
  await highlight(pickerB);
  // Người thứ 5 — gần như chắc chắn là con/cháu của người A trong tree
  // tuyến tính seed dựng.
  const fifthB = pickerB.locator("..").locator("ul li button").nth(4);
  await highlight(fifthB);
  await fifthB.click();
  await pause(page, 1500);

  // ─── Kết quả ────────────────────────────────────────────────
  await narrate(
    page,
    "App hiện ngay cách xưng hô từ 2 phía — vd. 'cha gọi con'.",
    { ms: 3000 },
  );
  await pause(page, 1500);

  await narrate(
    page,
    "Xong — không cần nhớ phong tục, app tự tính.",
    { ms: 2600 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
