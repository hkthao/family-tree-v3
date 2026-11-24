#!/usr/bin/env node
/**
 * Lấy giao diện từ landing/ để trang Astro giống hệt (CSS, script chọn giao diện sáng/tối, sprite icon, Umami, CSS bài viết)
 * và chép ảnh/tài sản dùng chung vào public/. Chạy tự động trước dev/build; mọi thứ sinh ra đều bị .gitignore.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const landing = join(root, "..", "landing");
const gen = join(root, "src/generated");
mkdirSync(gen, { recursive: true });

const index = readFileSync(join(landing, "index.html"), "utf8");
const build = readFileSync(join(root, "..", "scripts/build-landing-guides.mjs"), "utf8");

const css = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const extra = build.match(/const extraCss = `([\s\S]*?)`;/)[1];
writeFileSync(join(gen, "style.css"), css + extra);
writeFileSync(join(gen, "theme.html"), index.match(/<script>\s*\(function \(\) \{\s*try \{\s*var v = localStorage[\s\S]*?<\/script>/)[0]);
writeFileSync(join(gen, "sprite.html"), index.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/)[0]);
// Chân trang đầy đủ của trang chủ (cột Khám phá, Liên hệ, mã QR). Trang trong ở địa chỉ khác nên neo "#…" phải thành "/#…".
const footer = index.match(/<footer>[\s\S]*?<\/footer>/)[0].replace(/(<a\b[^>]*?)href="#/g, '$1href="/#'); // chỉ liên kết <a>, KHÔNG đụng <use href="#i-…"> của sprite biểu tượng
writeFileSync(join(gen, "footer.html"), footer);

// Đầu trang y hệt trang chủ (logo, menu, nút đổi sáng/tối, nút Tạo gia phả, nút mở menu điện thoại + bảng menu). Neo "#…" → "/#…";
// mục Blog được đánh dấu đang xem. (Nút "Tạo gia phả" luôn hiện nhờ class past-hero ở <body> của Base.)
const header = index
  .match(/<header>[\s\S]*?<\/header>/)[0]
  .replace(/(<a\b[^>]*?)href="#/g, '$1href="/#')
  .replace(/<a href="\/blog\.html">Blog<\/a>/g, '<a class="active" href="/blog.html">Blog</a>');
writeFileSync(join(gen, "header.html"), header);
writeFileSync(join(gen, "umami.html"), index.match(/<script defer src="https:\/\/analytics[\s\S]*?<\/script>/)[0]);

const pub = join(root, "public/assets");
mkdirSync(pub, { recursive: true });
cpSync(join(landing, "assets/le-hoi"), join(pub, "le-hoi"), { recursive: true });
for (const f of ["app-icon.svg", "app-icon-180.png", "og-banner.png", "app-qr.png"]) cpSync(join(landing, "assets", f), join(pub, f));
console.log("[sync-shell] ok");
