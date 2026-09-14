#!/usr/bin/env node
/**
 * Đổi một file SVG (rồng, phượng…) thành module TypeScript để bảng gia
 * phả dùng được ở CẢ bản xem trước lẫn file PDF.
 *
 * Vì sao phải đổi chứ không nhúng thẳng file SVG: bản in dựng bằng
 * @react-pdf, nó KHÔNG đọc file SVG — chỉ nhận từng thẻ Path/G. Nhúng
 * ảnh bitmap thì in khổ A0 sẽ rỗ. Nên hình được rút thành danh sách
 * đường nét, hai nơi vẽ chung một dữ liệu.
 *
 * Dùng:
 *   node scripts/convert-poster-creature.mjs <file.svg> <id> "<Nhãn>" <ra.ts>
 *
 * Giữ script trong repo để lần sau thêm hình khác còn làm lại được y hệt.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const [, , input, id, label, output] = process.argv;
if (!input || !id || !label || !output) {
  console.error("Thiếu tham số. Xem phần chú thích đầu file.");
  process.exit(1);
}

const dom = new JSDOM(readFileSync(input, "utf8"), { contentType: "image/svg+xml" });
const doc = dom.window.document;
const svg = doc.querySelector("svg");
if (!svg) throw new Error("Không tìm thấy thẻ <svg>");

const vbAttr = svg.getAttribute("viewBox");
if (!vbAttr) throw new Error("File không có viewBox — không biết đường nét nằm ở đâu");
const [vx, vy, vw, vh] = vbAttr.trim().split(/[\s,]+/).map(Number);

/** Đọc một thuộc tính trình bày từ cả `style=""` lẫn attribute rời. */
function prop(el, name) {
  const style = el.getAttribute("style") ?? "";
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(style);
  return (m?.[1] ?? el.getAttribute(name) ?? "").trim().toLowerCase();
}

/**
 * Màu sáng (trắng/gần trắng) là mảng khoét hoặc nét chi tiết vẽ đè lên
 * thân — tô bằng màu giấy. Còn lại là nét chính.
 *
 * Phải phân biệt được, vì có file vẽ chi tiết bằng NÉT trắng đè lên
 * silhouette đen: bỏ qua màu là cả con rồng thành một vệt đặc.
 */
function toneOf(color) {
  if (!color || color === "none") return null;
  const hex = color.replace(/^#/, "");
  if (color === "white" || /^f{3}$|^f{6}$/i.test(hex)) return "light";
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const lum =
      (parseInt(hex.slice(0, 2), 16) +
        parseInt(hex.slice(2, 4), 16) +
        parseInt(hex.slice(4, 6), 16)) /
      3;
    return lum > 200 ? "light" : "dark";
  }
  return "dark";
}

const shapes = [];
let dropped = 0;

/**
 * Một hình = phần tô + phần nét. Mặc định của SVG là tô đen, không nét —
 * nhưng chỉ khi file không nói gì cả.
 */
function describe(el, d, chain) {
  const fillRaw = prop(el, "fill");
  const strokeRaw = prop(el, "stroke");
  const fill = fillRaw === "" ? "dark" : toneOf(fillRaw);
  const stroke = toneOf(strokeRaw);
  if (!fill && !stroke) return null; // vô hình, bỏ cho nhẹ file
  const swRaw = Number(prop(el, "stroke-width") || 0);
  return {
    d,
    fill: fill ?? undefined,
    stroke: stroke ?? undefined,
    sw: stroke && swRaw ? Number(swRaw.toFixed(2)) : undefined,
    rule: el.getAttribute("fill-rule") === "evenodd" ? "evenodd" : undefined,
    transform: chain.length ? chain.join(" ") : undefined,
  };
}

function walk(el, transforms) {
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase();
    const t = child.getAttribute("transform");
    const chain = t ? [...transforms, t] : transforms;

    if (tag === "g" || tag === "svg") {
      walk(child, chain);
      continue;
    }
    if (tag === "path") {
      const d = child.getAttribute("d");
      if (!d) continue;
      const shape = describe(child, d.replace(/\s+/g, " ").trim(), chain);
      if (shape) shapes.push(shape);
      else dropped++;
      continue;
    }
    if (tag === "rect") {
      // Nền trắng phủ kín khung thì bỏ — tấm gia phả có nền riêng của nó.
      const w = Number(child.getAttribute("width") ?? 0);
      const h = Number(child.getAttribute("height") ?? 0);
      if (toneOf(prop(child, "fill")) === "light" && w >= vw * 0.95 && h >= vh * 0.95) {
        dropped++;
        continue;
      }
      const x = Number(child.getAttribute("x") ?? 0);
      const y = Number(child.getAttribute("y") ?? 0);
      const shape = describe(
        child,
        `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`,
        chain,
      );
      if (shape) shapes.push(shape);
      continue;
    }
    // Thẻ còn lại (use, clipPath, defs, metadata…) không dịch được sang
    // @react-pdf — đếm lại để biết hình có bị thiếu mảng nào không.
    if (!["defs", "metadata", "title", "desc", "style", "sodipodi:namedview"].includes(tag)) {
      dropped++;
    }
  }
}
walk(svg, []);

// Dữ liệu đường nét đi qua JSON thay vì viết thẳng thành mảng
// TypeScript: hình rồng có hơn ba nghìn nét, và TypeScript bó tay với
// một literal cỡ đó ("union type too complex"). JSON cũng gọn hơn vì
// không lặp lại tên khoá ở mọi phần tử.
const json = JSON.stringify(
  shapes.map((s) => {
    const o = { d: s.d };
    if (s.fill) o.f = s.fill === "light" ? 1 : 0;
    if (s.stroke) o.s = s.stroke === "light" ? 1 : 0;
    if (s.sw) o.w = s.sw;
    if (s.rule) o.e = 1;
    if (s.transform) o.t = s.transform;
    return o;
  }),
);

const ts = `// SINH TỰ ĐỘNG — đừng sửa tay.
// Nguồn: ${input.split("/").pop()}
// Lệnh: node scripts/convert-poster-creature.mjs <svg> ${id} "${label}" ${output}
import { expandShapes, type CreatureArt } from "@/lib/poster/creatures/types";

export const art: CreatureArt = {
  id: "${id}",
  label: ${JSON.stringify(label)},
  viewBox: { x: ${vx}, y: ${vy}, w: ${vw}, h: ${vh} },
  shapes: expandShapes(${JSON.stringify(json)}),
};
`;
writeFileSync(output, ts);
console.log(
  `${output}: ${shapes.length} đường nét, bỏ ${dropped} thẻ không dịch được, ${(ts.length / 1024).toFixed(0)} KB`,
);
