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
 * Video #3 — Thêm vợ/chồng + thêm con (xây Family Unit đời 2).
 *
 * Setup im lặng: tạo dòng họ + Thuỷ tổ "Nguyễn Văn Tổ" (1850).
 * Nội dung: từ trang chi tiết Thuỷ tổ, thêm vợ + 1 con.
 */
test("03 — Thêm vợ/chồng và con", async ({ page }) => {
  await login(page);
  await createClanWithRoot(page, "Họ Demo — Quan hệ", "Nguyễn Văn Tổ");
  await pause(page, 800);

  await narrate(
    page,
    "Hướng dẫn: Thêm vợ/chồng và con cái cho Thuỷ tổ.",
    { ms: 2600 },
  );

  // ─── Thêm vợ ────────────────────────────────────────────────
  await narrate(
    page,
    "Bước 1 — Bấm 'Thêm' cạnh mục 'Vợ / chồng'.",
  );
  const addSpouseBtn = page.getByTestId("add-spouse-button");
  await highlight(addSpouseBtn);
  await addSpouseBtn.click();
  await pause(page, 700);

  await narrate(page, "Bước 2 — Nhập tên vợ và năm sinh.");
  const spouseName = page.getByTestId("spouse-name-input");
  await highlight(spouseName);
  await spouseName.click();
  await spouseName.pressSequentially("Trần Thị Cội", { delay: 130 });
  await pause(page, 400);

  const spouseYear = page.getByTestId("birth-year-input");
  await highlight(spouseYear);
  await spouseYear.click();
  await spouseYear.pressSequentially("1855", { delay: 200 });
  await pause(page, 600);

  await narrate(page, "Bấm 'Lưu' để nối quan hệ.");
  const spouseSubmit = page.getByTestId("spouse-submit-button");
  await highlight(spouseSubmit);
  await spouseSubmit.click();
  // Sheet đóng — chờ form biến mất.
  await spouseName.waitFor({ state: "hidden", timeout: 15_000 });
  await pause(page, 1200);

  // ─── Thêm con ───────────────────────────────────────────────
  await narrate(
    page,
    "Bước 3 — Bấm 'Thêm' cạnh 'Con cái'.",
  );
  const addChildBtn = page.getByTestId("add-child-button");
  await highlight(addChildBtn);
  await addChildBtn.click();
  await pause(page, 700);

  await narrate(
    page,
    "App tự gợi ý vợ/chồng làm cha mẹ thứ hai.",
    { ms: 2600 },
  );

  await narrate(page, "Bước 4 — Nhập tên con và năm sinh.");
  const childName = page.getByTestId("child-name-input");
  await highlight(childName);
  await childName.click();
  await childName.pressSequentially("Nguyễn Văn Hai", { delay: 130 });
  await pause(page, 400);

  const childYear = page.getByTestId("birth-year-input");
  await highlight(childYear);
  await childYear.click();
  await childYear.pressSequentially("1880", { delay: 200 });
  await pause(page, 600);

  await narrate(page, "Bấm 'Lưu'.");
  const childSubmit = page.getByTestId("child-submit-button");
  await highlight(childSubmit);
  await childSubmit.click();
  await childName.waitFor({ state: "hidden", timeout: 15_000 });
  await pause(page, 1500);

  // ─── Kết ────────────────────────────────────────────────────
  await narrate(
    page,
    "Xong — vợ và con đã hiện trong mục Quan hệ.",
    { ms: 2600 },
  );
  await clearCaption(page);
  await pause(page, 400);
});
