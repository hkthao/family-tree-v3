#!/usr/bin/env node
/**
 * Sổ tay Văn hoá đọc bài từ public/so-tay-data/*.json (KHÔNG còn bảng DB). Các tệp này do content-site sinh ra từ
 * content-site/content/so-tay/*.md. Script này đảm bảo chúng có mặt trước dev/build của app:
 *   - đã có và mới hơn mọi tệp .md  → bỏ qua
 *   - thiếu hoặc cũ                  → cài content-site (nếu cần), build, chép dist/so-tay-data vào public/
 * Chạy ép dựng lại: `node scripts/ensure-so-tay-data.mjs --force` (hoặc `npm run so-tay:data`).
 * Không có Node/npm phù hợp hoặc build lỗi → in cảnh báo, thoát 0 (app vẫn chạy, Sổ tay trống) trừ khi đặt SO_TAY_STRICT=1.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "content-site");
const out = join(root, "public/so-tay-data");
const force = process.argv.includes("--force");

function newestMd() {
  const dir = join(site, "content/so-tay");
  if (!existsSync(dir)) return 0;
  return Math.max(0, ...readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => statSync(join(dir, f)).mtimeMs));
}

if (!existsSync(site)) {
  console.log("[so-tay-data] không có content-site/, bỏ qua");
  process.exit(0);
}
const idx = join(out, "index.json");
if (!force && existsSync(idx) && statSync(idx).mtimeMs >= newestMd()) {
  console.log("[so-tay-data] đã cập nhật, bỏ qua");
  process.exit(0);
}

const run = (args) => spawnSync("npm", args, { cwd: site, stdio: "inherit" }).status === 0;
try {
  if (!existsSync(join(site, "node_modules"))) {
    if (!run(["install", "--no-audit", "--no-fund", "--loglevel=error"])) throw new Error("npm install content-site lỗi");
  }
  if (!run(["run", "build", "--silent"])) throw new Error("build content-site lỗi");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(site, "dist/so-tay-data"), out, { recursive: true });
  console.log("[so-tay-data] đã chép vào public/so-tay-data");
} catch (e) {
  console.warn(`[so-tay-data] ${e.message}; Sổ tay sẽ trống cho tới khi dựng được dữ liệu`);
  if (process.env.SO_TAY_STRICT === "1") process.exit(1);
}
