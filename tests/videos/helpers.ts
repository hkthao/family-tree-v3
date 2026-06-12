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

/**
 * Bật vùng an toàn (safe area) cho phụ đề: video mobile-fullhd
 * 1080×1920 phát lên Reels/TikTok/FB Watch thì UI nền tảng (avatar,
 * tên page, like/comment/share, caption hệ thống) che ~250px trên +
 * ~350px dưới. Viewport playwright là 540×960 → ffmpeg upscale 2× →
 * cần chừa ≥175px dưới + ≥125px trên trong toạ độ viewport. Gọi 1
 * lần đầu spec, narrate()/highlight tự đọc cờ này khi đặt vị trí.
 */
export async function enableSafeArea(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __ftSafeArea?: boolean }).__ftSafeArea = true;
  });
}

export async function narrate(
  page: Page,
  text: string,
  opts: { ms?: number } = {},
): Promise<void> {
  await page.evaluate((t) => {
    const id = "__ft_caption__";
    const safe = (window as unknown as { __ftSafeArea?: boolean }).__ftSafeArea === true;
    // Vùng an toàn: bottom 190px ở viewport 540×960 ≈ 380px khi
    // upscale lên 1080×1920 — vừa nằm trên vùng 350px Reels/TikTok
    // chiếm. Còn 16px là mặc định cũ cho desktop / mobile thường.
    const bottom = safe ? "190px" : "16px";
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.cssText = [
        "position:fixed",
        "left:12px",
        "right:12px",
        `bottom:${bottom}`,
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
    } else {
      el.style.bottom = bottom;
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

/**
 * Mở drawer trái (nút ☰) rồi click vào item có nhãn `label`. Highlight
 * cả hai bước để người xem hiểu "đây là chỗ bấm". Đợi URL khớp
 * `urlPattern` nếu truyền — không truyền thì chỉ đợi navigation bất
 * kỳ.
 *
 * Dùng thay cho `page.goto(...)` trong các video tour: mục đích video
 * là DẠY người xem thao tác app, không phải nhảy tắt.
 */
export async function navigateViaDrawer(
  page: Page,
  label: string | RegExp,
  urlPattern?: RegExp,
): Promise<void> {
  // 1) Mở drawer: nút ☰ ở header. aria-label bắt đầu bằng "Mở menu"
  //    (DrawerToggle trong ClanLayout.tsx). Trên desktop ≥lg drawer
  //    luôn mở nên nút bị `lg:hidden` — viewport video toàn ≤960
  //    height nhưng width 540 < 1024 nên vẫn nhìn thấy nút.
  const toggle = page.locator('button[aria-label^="Mở menu"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await highlight(toggle, { ms: 800 });
    await toggle.click();
    // Drawer dùng transition 200ms — chờ để ai cũng kịp thấy nó trượt vào.
    await page.waitForTimeout(450);
  }

  // 2) Click item theo nhãn. Drawer là <nav> chứa <NavLink> với text
  //    trong <span class="flex-1">. Dùng getByRole('link', {name})
  //    match cả text lẫn aria-label.
  const item = page.getByRole("link", { name: label }).first();
  await highlight(item, { ms: 1100 });
  await item.click();

  if (urlPattern) {
    await page.waitForURL(urlPattern, { timeout: 12_000 });
  }
  // Drawer tự đóng (onClose() được gọi qua `pick()` trong AppDrawer).
  await pause(page, 800);
}

/**
 * Mô phỏng pinch 2 ngón trên cây gia phả: vẽ 2 chấm tròn ở giữa
 * `svg.main_svg`, animate tách ra (zoom in) hoặc thu vào (zoom out)
 * trong ~1.4s — đồng thời dispatch chuỗi `WheelEvent` với
 * `ctrlKey:true` vào SVG để d3.zoom (family-chart dùng) thực sự
 * scale-by. Browser map "trackpad pinch" thành wheel+ctrlKey nên
 * d3.zoom handler không phân biệt được — chart zoom thật.
 *
 * Yêu cầu: `svg.main_svg` đã render (gọi sau khi `.f3 svg` waitFor).
 */
export async function pinchZoom(
  page: Page,
  direction: "in" | "out" = "in",
  opts: { steps?: number } = {},
): Promise<void> {
  const steps = opts.steps ?? 14;
  await page.evaluate(
    async ({ dir, steps }) => {
      const svg = document.querySelector("svg.main_svg") as SVGSVGElement | null;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // 2 chấm tròn ghost-finger. Bắt đầu sát nhau (zoom in) hoặc xa
      // nhau (zoom out), kết thúc ngược lại — viewer thấy 2 ngón tách
      // ra / chụm vào trên cây.
      const startGap = dir === "in" ? 40 : 220;
      const endGap = dir === "in" ? 220 : 40;
      const mk = (id: string) => {
        const el = document.createElement("div");
        el.id = id;
        el.style.cssText = [
          "position:fixed",
          "width:56px",
          "height:56px",
          "border-radius:50%",
          "background:rgba(239,68,68,0.35)",
          "border:3px solid #ef4444",
          "box-shadow:0 0 0 6px rgba(239,68,68,0.18)",
          "pointer-events:none",
          "z-index:2147483646",
          "transition:left 1300ms ease, top 1300ms ease",
          "transform:translate(-50%,-50%)",
        ].join(";");
        document.body.appendChild(el);
        return el;
      };
      const a = mk("__ft_finger_a__");
      const b = mk("__ft_finger_b__");
      const place = (gap: number) => {
        a.style.left = `${cx - gap}px`;
        a.style.top = `${cy}px`;
        b.style.left = `${cx + gap}px`;
        b.style.top = `${cy}px`;
      };
      place(startGap);
      // 1 tick để browser commit style ban đầu trước khi đặt style đích.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      place(endGap);

      // Dispatch wheel+ctrlKey để d3.zoom scale-by. Spread đều trong
      // ~1.3s khớp animation 2 ngón.
      const totalMs = 1300;
      const delta = dir === "in" ? -22 : 22;
      for (let i = 0; i < steps; i++) {
        const ev = new WheelEvent("wheel", {
          clientX: cx,
          clientY: cy,
          deltaY: delta,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        svg.dispatchEvent(ev);
        await new Promise((r) => setTimeout(r, totalMs / steps));
      }
      await new Promise((r) => setTimeout(r, 200));
      a.remove();
      b.remove();
    },
    { dir: direction, steps },
  );
}

/**
 * Trên mobile nhiều trang dài quá viewport — chỉ chụp khung trên thì
 * người xem không thấy hết nội dung. Helper này cuộn nhẹ xuống đáy
 * rồi cuộn lại đầu trong ~3.5s để viewer kịp lướt qua.
 *
 * Dùng `window.scrollBy` thay `mouse.wheel` vì narrate overlay sẽ
 * không cuộn theo — caption vẫn cố định ở đáy.
 */
export async function scrollTour(
  page: Page,
  opts: { downMs?: number; upMs?: number } = {},
): Promise<void> {
  const downMs = opts.downMs ?? 2100;
  const upMs = opts.upMs ?? 1300;
  await page.evaluate(
    async ({ downMs, upMs }) => {
      const total = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0,
      );
      if (total < 40) return; // không có gì để cuộn
      const easeDown = async (dur: number, from: number, to: number) => {
        const start = performance.now();
        return new Promise<void>((resolve) => {
          const tick = () => {
            const t = Math.min(1, (performance.now() - start) / dur);
            // easeInOutQuad
            const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            window.scrollTo(0, from + (to - from) * k);
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      };
      await easeDown(downMs, 0, total);
      await new Promise((r) => setTimeout(r, 350));
      await easeDown(upMs, total, 0);
    },
    { downMs, upMs },
  );
}
