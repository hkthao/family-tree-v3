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
writeFileSync(join(gen, "umami.html"), index.match(/<script defer src="https:\/\/analytics[\s\S]*?<\/script>/)[0]);

const pub = join(root, "public/assets");
mkdirSync(pub, { recursive: true });
cpSync(join(landing, "assets/le-hoi"), join(pub, "le-hoi"), { recursive: true });
for (const f of ["app-icon.svg", "app-icon-180.png", "og-banner.png"]) cpSync(join(landing, "assets", f), join(pub, f));
console.log("[sync-shell] ok");
