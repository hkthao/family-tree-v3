#!/usr/bin/env node
/**
 * Đổi một file SVG NHIỀU MÀU (cuốn thư, khung, linh vật vẽ tay) thành
 * module TypeScript cho bảng gia phả.
 *
 * Khác `convert-poster-creature.mjs` ở một điểm quyết định: script kia
 * quy mọi nét về hai tông (đậm/nhạt) để tô theo bảng màu của tấm — hợp
 * với hình một màu. Còn cuốn thư truyền thống thì MÀU CHÍNH LÀ NỘI DUNG:
 * rồng vàng, nền đỏ son, hoa đào hồng, lá xanh. Đổi màu là hỏng.
 *
 * Dùng:
 *   node scripts/convert-poster-artwork.mjs <file.svg> <id> "<Nhãn>" <ra.ts> [--trim=0.03]
 *
 * `--trim` bỏ các hình chạm vào rìa (hoạ tiết góc, dải viền mép) — thứ
 * mình không cần vì tấm gia phả đã có khung riêng.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const args = process.argv.slice(2);
const [input, id, label, output] = args.filter((a) => !a.startsWith("--"));
const trim = Number((args.find((a) => a.startsWith("--trim=")) || "--trim=0").split("=")[1]);
if (!input || !id || !label || !output) {
  console.error("Thiếu tham số — xem chú thích đầu file.");
  process.exit(1);
}

const dom = new JSDOM(readFileSync(input, "utf8"), { contentType: "image/svg+xml" });
const doc = dom.window.document;
const svg = doc.querySelector("svg");
const [vx, vy, vw, vh] = svg.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);

/** Khung bao của một path, tính thô từ các số trong thuộc tính `d`. */
function roughBox(d) {
  const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi);
  if (!nums || nums.length < 4) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]), y = Number(nums[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

const shapes = [];
let dropped = 0;
for (const el of svg.querySelectorAll("path")) {
  const d = el.getAttribute("d");
  if (!d) continue;
  const fill = (el.getAttribute("fill") || "").trim();
  const stroke = (el.getAttribute("stroke") || "").trim();
  if ((!fill || fill === "none") && (!stroke || stroke === "none")) { dropped++; continue; }

  if (trim > 0) {
    const bb = roughBox(d);
    // Chạm rìa = hoạ tiết góc hoặc dải viền mép của bản gốc. Tấm gia phả
    // đã có khung riêng, giữ lại là hai lớp viền chồng nhau.
    if (bb &&
        (bb.x < vx + vw * trim || bb.y < vy + vh * trim ||
         bb.x + bb.w > vx + vw * (1 - trim) || bb.y + bb.h > vy + vh * (1 - trim))) {
      dropped++; continue;
    }
  }
  const sw = Number(el.getAttribute("stroke-width") || 0) || undefined;
  shapes.push({
    d: d.replace(/\s+/g, " ").trim(),
    f: fill && fill !== "none" ? fill : undefined,
    s: stroke && stroke !== "none" ? stroke : undefined,
    w: sw,
  });
}

const json = JSON.stringify(shapes);
const ts = `// SINH TỰ ĐỘNG — đừng sửa tay.
// Nguồn: ${input.split("/").pop()}
// Lệnh: node scripts/convert-poster-artwork.mjs <svg> ${id} "${label}" ${output} --trim=${trim}
import { expandArtwork, type PosterArtwork } from "@/lib/poster/artwork/types";

export const artwork: PosterArtwork = {
  id: "${id}",
  label: ${JSON.stringify(label)},
  viewBox: { x: ${vx}, y: ${vy}, w: ${vw}, h: ${vh} },
  shapes: expandArtwork(${JSON.stringify(json)}),
};
`;
writeFileSync(output, ts);
console.log(`${output}: giữ ${shapes.length} hình, bỏ ${dropped}, ${(ts.length / 1024).toFixed(0)} KB`);
