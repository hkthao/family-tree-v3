#!/usr/bin/env node
/** Chép ảnh bài viết vào dist/so-tay-data/img/ để app dùng cùng origin (xem src/data.ts). */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "dist/assets/le-hoi");
const to = join(root, "dist/so-tay-data/img");
if (existsSync(from)) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}
console.log("[copy-img] ok");
