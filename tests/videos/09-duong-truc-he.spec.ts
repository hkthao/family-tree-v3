import { test } from "@playwright/test";

import {
  clearCaption,
  highlight,
  login,
  narrate,
  pause,
} from "./helpers";

/**
 * Video #9 — Đường trực hệ "từ tôi về thuỷ tổ".
 *
 * Lần đầu vào: app hỏi "Bạn là ai trong gia phả?" → chọn 1 người.
 * Lần sau: hiện đường trực hệ luôn. Video bao luôn cả 2 trường hợp.
 */
test("09 — Đường trực hệ", async ({ page }) => {
  await login(page, "small-admin@example.test");
  await page.goto("/clans");
  const firstClan = page
    .locator('a[href^="/clans/"]:not([href="/clans/new"])')
    .first();
  const href = await firstClan.getAttribute("href");
  const clanId = href?.match(/\/clans\/([0-9a-f-]+)/)?.[1] ?? "";
  await page.goto(`/clans/${clanId}/my-lineage`);
  await page.waitForLoadState("networkidle");
  await pause(page, 1500);

  await narrate(
    page,
    "Hướng dẫn: Đường trực hệ — chuỗi tổ tiên từ bạn về Thuỷ tổ.",
    { ms: 3200 },
  );

  // ─── Nếu chưa claim: tìm và chọn 1 người làm "mình" ─────────
  const claimSearch = page.getByPlaceholder(
    "Gõ tên của bạn trong gia phả…",
  );
  if (await claimSearch.isVisible()) {
    await narrate(
      page,
      "Lần đầu: chọn bạn là ai trong gia phả.",
    );
    await highlight(claimSearch);
    await claimSearch.click();
    await claimSearch.pressSequentially("Văn", { delay: 180 });
    await pause(page, 1200);

    const firstMatch = page.locator("ul li button").first();
    await highlight(firstMatch);
    await firstMatch.click();
    await page.waitForLoadState("networkidle");
    await pause(page, 2000);
  }

  // ─── Đường trực hệ ──────────────────────────────────────────
  await narrate(
    page,
    "Mặc định đi theo bên nội — chuỗi cha-ông-cụ-kỵ.",
    { ms: 3000 },
  );

  // ─── Bên ngoại ──────────────────────────────────────────────
  const maternal = page.getByRole("button", { name: "Bên ngoại" }).first();
  if (await maternal.isVisible().catch(() => false)) {
    await narrate(
      page,
      "Mỗi đời có thể đổi sang bên ngoại nếu muốn.",
    );
    await highlight(maternal);
    await maternal.click();
    await pause(page, 2000);
  }

  await narrate(
    page,
    "Xong — bạn đã thấy chuỗi tổ tiên trực hệ.",
    { ms: 2800 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
