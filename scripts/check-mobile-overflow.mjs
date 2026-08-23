#!/usr/bin/env node
/**
 * Tìm chỗ TRÀN NGANG trên màn hẹp (360px) bằng máy, không bằng mắt.
 *
 * Vì sao cần: `<main>` của app đặt `overflow-x-clip`, nên phần tràn bị
 * CẮT chứ không tạo thanh cuộn. Nhìn ảnh chụp rất dễ tưởng là bình
 * thường, trong khi nút đã bị đẩy ra ngoài mép trái và không bấm tới
 * được — đúng lỗi ở màn "Thêm người" (hàng `justify-end` ba nút).
 *
 * Bắt hai chiều:
 *  - `right > innerWidth`  → tràn phải (thường thấy)
 *  - `left  < 0`           → tràn TRÁI, hậu quả của `justify-end` không
 *                            xuống dòng; đây mới là loại giấu mặt
 *
 * Bỏ qua: phần tử `position: fixed`, drawer off-canvas (dịch bằng
 * transform hoặc `aria-hidden`), và mọi thứ nằm trong vùng cố ý cuộn
 * ngang (`.overflow-x-auto`…).
 *
 * Cần: Supabase local đang chạy + `npm run seed` + dev server ở :5199.
 * Chạy:  node scripts/check-mobile-overflow.mjs
 * Không có output = không có chỗ nào tràn.
 */
import { chromium } from "playwright";

const CLAN = "57a63b46-619a-43cd-b8f6-eef7ca8a65ca";
const PATHS = [
  "/clans", "/account", "/so-tay", "/lien-he",
  `/clans/${CLAN}`, `/clans/${CLAN}/people`, `/clans/${CLAN}/people/new`,
  `/clans/${CLAN}/tree`, `/clans/${CLAN}/events`, `/clans/${CLAN}/today`,
  `/clans/${CLAN}/settings`, `/clans/${CLAN}/members`, `/clans/${CLAN}/board`,
  `/clans/${CLAN}/graves`, `/clans/${CLAN}/graves/new`,
  `/clans/${CLAN}/heritage`, `/clans/${CLAN}/heritage/new`,
  `/clans/${CLAN}/inlaws`, `/clans/${CLAN}/inlaws/new`, `/clans/${CLAN}/fund`,
  `/clans/${CLAN}/honors`, `/clans/${CLAN}/todo`, `/clans/${CLAN}/import`,
  `/clans/${CLAN}/audit`, `/clans/${CLAN}/qr-export`, `/clans/${CLAN}/merge`,
  `/clans/${CLAN}/kinship`, `/clans/${CLAN}/ai-generate`, `/clans/${CLAN}/memory-rooms`,
  // trang chi tiết — nơi có nhiều hàng nút nhất
  `/clans/${CLAN}/people/05fd7d3b-9d74-4cb1-8b48-918bfa323e68`,
  `/clans/${CLAN}/people/05fd7d3b-9d74-4cb1-8b48-918bfa323e68/edit`,
  `/clans/${CLAN}/graves/d50291c6-7250-41ca-9ec9-a21c74dd942b`,
  `/clans/${CLAN}/board/2649df2c-9351-4c5f-8c73-7ceb647cf4a6`,
  `/clans/${CLAN}/people/05fd7d3b-9d74-4cb1-8b48-918bfa323e68/add-child`,
  `/clans/${CLAN}/people/05fd7d3b-9d74-4cb1-8b48-918bfa323e68/add-spouse`,
  `/clans/${CLAN}/people/05fd7d3b-9d74-4cb1-8b48-918bfa323e68/add-parent`,
];

/** Trạng thái phải bấm mới hiện — thanh chọn hàng loạt, form gập… */
const INTERACTIONS = [
  [`/clans/${CLAN}/people`, async (p) => {
    await p.locator('input[type="checkbox"]').first().check();
  }],
  [`/clans/${CLAN}/todo`, async (p) => {
    await p.locator('input[type="checkbox"]').first().check();
  }],
  [`/clans/${CLAN}/graves/d50291c6-7250-41ca-9ec9-a21c74dd942b`, async (p) => {
    await p.getByRole("button", { name: /Đặt nhắc/ }).click();
  }],
];

const check = () => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      // Bỏ phần tử nằm HẲN ngoài màn bên trái: đó là drawer off-canvas,
      // không phải tràn. Chỉ quan tâm thứ đang nhìn thấy mà bị cắt.
      if (r.right <= 0) continue;
      // Thành phần bị dịch ra ngoài bằng transform cũng là off-canvas.
      let off = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const t = getComputedStyle(n).transform;
        if (t && t !== "none" && t.includes("matrix") && Number(t.split(",")[4]) < -10) { off = true; break; }
        if (n.getAttribute("aria-hidden") === "true") { off = true; break; }
      }
      if (off) continue;
      // Bỏ qua phần tử tự cuộn ngang (cố ý) và con của nó
      if (el.closest("[data-x-scroll], .overflow-x-auto, .overflow-auto, .overflow-x-scroll")) continue;
      // Tràn TRÁI cũng phải bắt: hàng `justify-end` rộng quá khung sẽ
      // đẩy nút đầu tiên ra ngoài mép trái, không cuộn tới được — đúng
      // lỗi ở màn Thêm người.
      if (r.right > vw + 1 || r.left < -1) {
        out.push({
          el,
          tag: el.tagName.toLowerCase(),
          cls: (el.className && String(el.className)).slice(0, 70),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
          left: Math.round(r.left), right: Math.round(r.right),
        });
      }
    }
    // chỉ giữ phần tử NGOÀI CÙNG bị tràn (bỏ con cháu trùng lặp)
    // Chỉ giữ phần tử ngoài cùng: bỏ cái nào có tổ tiên cũng đang tràn.
    const outer = out.filter((o) => !out.some((p) => p !== o && p.el.contains(o.el)));
    return {
      vw,
      scroll: document.documentElement.scrollWidth,
      items: outer.slice(0, 6).map(({ el, ...rest }) => rest),
    };
  };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto("http://localhost:5199/login", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /email & mật khẩu/i }).click();
await p.getByLabel("Email").fill("small-admin@example.test");
await p.getByLabel("Mật khẩu").fill("demo-password-1234");
await p.getByRole("button", { name: /Đăng nhập$/ }).click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

for (const path of PATHS) {
  try {
    await p.goto("http://localhost:5199" + path, { waitUntil: "networkidle", timeout: 20000 });
  } catch { /* trang chậm — vẫn kiểm cái đã render */ }
  await p.waitForTimeout(900);
  const bad = await p.evaluate(check);
  if (bad.scroll > bad.vw + 1 || bad.items.length) {
    console.log(`\n### ${path}  (scrollWidth ${bad.scroll} / ${bad.vw})`);
    for (const i of bad.items) console.log(`   ${i.left}→${i.right} <${i.tag}> ${i.text} | ${i.cls}`);
  }
}

for (const [path, act] of INTERACTIONS) {
  await p.goto("http://localhost:5199" + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  try { await act(p); } catch (e) { console.log("bỏ qua tương tác", path, String(e).slice(0, 80)); continue; }
  await p.waitForTimeout(600);
  const bad = await p.evaluate(check);
  if (bad.items.length) {
    console.log(`\n### ${path} (sau tương tác)`);
    for (const i of bad.items) console.log(`   ${i.left}→${i.right} <${i.tag}> ${i.text} | ${i.cls}`);
  }
}
await b.close();
