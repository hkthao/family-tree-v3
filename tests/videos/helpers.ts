import type { Locator, Page } from "@playwright/test";

/**
 * Helpers dùng chung cho các video hướng dẫn sử dụng.
 *
 *  - `login(page)`        — đăng nhập sẵn vào tài khoản admin của seed.
 *  - `narrate(page, txt)` — overlay 1 dải chú thích ở đáy màn hình
 *                           (Playwright không có voiceover — phụ đề là
 *                           cách rẻ nhất để người xem hiểu).
 *  - `highlight(locator)` — vẽ viền đỏ + scale element trước khi click,
 *                           để mắt người xem thấy "app đang nhấn cái gì".
 *  - `pause(page, ms)`    — bọc `waitForTimeout` cho gọn, đỡ ai cũng
 *                           viết lại số.
 *
 * Tất cả đều idempotent + an toàn nếu gọi nhiều lần.
 */

export const SEED_EMAIL = "admin@example.test";
export const SEED_PASSWORD = "demo-password-1234";

export async function login(
  page: Page,
  email: string = SEED_EMAIL,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /Đăng nhập$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

export async function narrate(
  page: Page,
  text: string,
  opts: { ms?: number } = {},
): Promise<void> {
  await page.evaluate((t) => {
    const id = "__ft_caption__";
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.cssText = [
        "position:fixed",
        "left:12px",
        "right:12px",
        "bottom:16px",
        "z-index:2147483647",
        "padding:10px 14px",
        "border-radius:10px",
        "background:rgba(15,15,15,0.88)",
        "color:#fff",
        "font:500 15px/1.35 'Be Vietnam Pro',system-ui,sans-serif",
        "text-align:center",
        "box-shadow:0 6px 24px rgba(0,0,0,0.35)",
        "pointer-events:none",
        "max-height:30vh",
        "overflow:hidden",
      ].join(";");
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  // Người Việt đọc tiếng Việt cỡ 4–5 ký tự/giây ở nhịp thoải mái. 95ms
  // /ký tự + sàn 2000ms cho câu ngắn = vừa kịp đọc cả câu rồi mới chuyển.
  await page.waitForTimeout(opts.ms ?? Math.max(2000, text.length * 95));
}

export async function clearCaption(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById("__ft_caption__")?.remove();
  });
}

export async function highlight(
  locator: Locator,
  opts: { ms?: number } = {},
): Promise<void> {
  const page = locator.page();
  await locator.scrollIntoViewIfNeeded();
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => {
    if (!(el instanceof HTMLElement)) return;
    const prev = el.style.cssText;
    el.dataset.ftPrevStyle = prev;
    el.style.outline = "3px solid #ef4444";
    el.style.outlineOffset = "2px";
    el.style.borderRadius = el.style.borderRadius || "6px";
    el.style.transition = "transform 200ms ease";
    el.style.transform = "scale(1.04)";
  }, handle);
  // Giữ viền đỏ ~1.2s — đủ để mắt người xem định vị element trước khi
  // app click vào nó.
  await page.waitForTimeout(opts.ms ?? 1200);
  await page.evaluate((el) => {
    if (!(el instanceof HTMLElement)) return;
    const prev = el.dataset.ftPrevStyle ?? "";
    el.style.cssText = prev;
    delete el.dataset.ftPrevStyle;
  }, handle);
}

export async function pause(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Splash toàn màn hình hiển thị logo + tên app + slogan. Dùng để mở
 * đầu / kết thúc video tour. Caller tự `pause()` sau khi gọi để giữ
 * splash trên màn rồi gọi `hideSplash()` để dọn (hoặc để navigation
 * tự xoá DOM khi page.goto sau đó).
 */
export async function splash(page: Page): Promise<void> {
  await page.evaluate(() => {
    const id = "__ft_splash__";
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483646",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "gap:28px",
      "background:linear-gradient(180deg,#fef7e6 0%,#f6e8c4 100%)",
      "font-family:'Be Vietnam Pro',system-ui,sans-serif",
      "color:#3a2a14",
    ].join(";");
    el.innerHTML = [
      '<img src="/icons/app-icon-512.png" ',
      'style="width:200px;height:200px;border-radius:40px;',
      'box-shadow:0 18px 50px rgba(60,40,10,0.25)" />',
      '<div style="font-size:48px;font-weight:700;letter-spacing:0.5px">Gia phả</div>',
      '<div style="font-size:22px;color:#6a4d20;text-align:center;padding:0 32px">',
      "Quản lý cây dòng họ Việt",
      "</div>",
    ].join("");
    document.body.appendChild(el);
  });
}

export async function hideSplash(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById("__ft_splash__")?.remove();
  });
}

/**
 * Tạo nhanh một dòng họ rỗng cho video tiếp theo dùng làm điểm xuất
 * phát "sạch". Bước này KHÔNG nên có narrate() — nó là setup, không
 * phải nội dung hướng dẫn. Người xem chỉ thấy 4-5 giây thao tác im
 * lặng trên trang Tạo dòng họ rồi vào ngay nội dung chính.
 *
 * Kết thúc: trang `/clans/:id` (Dashboard) của clan vừa tạo, chỉ có
 * empty state.
 */
export async function createEmptyClan(
  page: Page,
  name: string,
): Promise<string> {
  await page.goto("/clans/new");
  const nameInput = page.getByTestId("clan-name-input");
  await nameInput.fill(name);
  await page.getByTestId("clan-submit-button").click();
  await page.waitForURL(/\/clans\/[0-9a-f-]+$/, { timeout: 15_000 });
  return page.url().match(/\/clans\/([0-9a-f-]+)$/)?.[1] ?? "";
}

/**
 * Setup im lặng cho mọi video cần một Thuỷ tổ sẵn. Tạo clan rỗng +
 * thêm 1 người root + điều hướng vào PersonDetail của người đó.
 *
 * Dùng `.fill()` thay `.pressSequentially()` để chạy nhanh (đây là
 * setup không cần demo).
 */
export async function createClanWithRoot(
  page: Page,
  clanName: string,
  rootName: string,
  rootYear = "1850",
): Promise<{ clanId: string; personId: string }> {
  const clanId = await createEmptyClan(page, clanName);
  await page.getByTestId("dashboard-add-person-link").click();
  await page.waitForURL(/\/people\/new$/);
  await page.getByTestId("person-name-input").fill(rootName);
  await page.getByTestId("birth-year-input").fill(rootYear);
  await page.getByTestId("person-is-root-checkbox").check();
  await page.getByTestId("person-submit-button").click();
  await page.waitForURL(/\/people$/, { timeout: 15_000 });
  // Click vào person card mới tạo để vào PersonDetail.
  await page.locator(`a[href*="/people/"]`, { hasText: rootName }).first().click();
  await page.waitForURL(/\/people\/[0-9a-f-]+$/);
  const personId = page.url().match(/\/people\/([0-9a-f-]+)$/)?.[1] ?? "";
  return { clanId, personId };
}
