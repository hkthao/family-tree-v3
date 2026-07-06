// Bọc SVG Hero-Patterns (path đen, nền trong suốt) thành texture dùng được:
// nền trắng + pattern mờ → khi làm map, pedestalColor tô nền, pattern nổi lên.
// Cũng sinh manifest src/components/gallery/patternTextures.ts.
// Chạy: node scripts/wrap-pattern-textures.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "/Users/kimthaohuynh/Downloads";
const OUT = "public/textures";
mkdirSync(OUT, { recursive: true });

const FILES = [
  // đợt 1
  "jigsaw", "topography", "formal-invitation", "texture", "jupiter", "temple",
  "stamp-collection", "overcast",
  // đợt 2
  "wallpaper", "death-star", "i-like-food", "church-on-sunday", "4-point-stars",
  "overlapping-hexagons", "bathroom-floor", "lips", "cork-screw", "kiwi",
  "random-shapes", "steel-beams", "tiny-checkers", "lisbon", "anchors-away",
  "x-equals", "bevel-circle", "brick-wall", "heavy-rain", "fancy-rectangles",
  "overlapping-circles", "plus", "volcano-lamp", "wiggle",
  "rounded-plus-connected", "bubbles", "connections", "cage", "floating-cogs",
  "diagonal-stripes", "current", "flipped-diamonds", "houndstooth", "glamorous",
  "leaf", "line-in-motion", "morphing-diamonds", "moroccan", "rain",
  "squares-in-squares", "rails", "tic-tac-toe", "aztec", "stripes", "zig-zag",
  "bank-note", "boxes", "circles-and-squares", "circuit-board", "diagonal-lines",
  "curtain", "endless-clouds", "eyes", "groovy", "floor-tile",
  "intersecting-circles", "pixel-dots", "parkay-floor", "overlapping-diamonds",
  "polka-dots", "slanted-stars", "signal", "melt",
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pretty = (slug) => slug.split("-").map(cap).join(" ");

const manifest = [];
for (const name of FILES) {
  const path = `${SRC}/${name}.svg`;
  const outPath = `${OUT}/pat-${name}.svg`;
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    const open = raw.match(/<svg[^>]*>/)?.[0] ?? "";
    // Ưu tiên viewBox (đáng tin) để tránh letterbox khi width/height ghi "px".
    const wAttr = open.match(/width="([\d.]+)/)?.[1];
    const hAttr = open.match(/height="([\d.]+)/)?.[1];
    const vb = (open.match(/viewBox="([^"]+)"/)?.[1] ?? "")
      .split(/[\s,]+/)
      .map(Number);
    const minX = vb.length === 4 ? vb[0] : 0;
    const minY = vb.length === 4 ? vb[1] : 0;
    const vbW = vb.length === 4 ? vb[2] : Number(wAttr) || 100;
    const vbH = vb.length === 4 ? vb[3] : Number(hAttr) || 100;
    const viewBox = `${minX} ${minY} ${vbW} ${vbH}`;
    const inner = raw
      .slice(raw.indexOf(">", raw.indexOf("<svg")) + 1, raw.lastIndexOf("</svg>"))
      .trim();
    // root width/height = kích thước viewBox → raster đúng tỉ lệ, không có dải đen.
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}" viewBox="${viewBox}"><rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="#ffffff"/><g fill-opacity="0.22">${inner}</g></svg>`;
    writeFileSync(outPath, out);
  }
  if (existsSync(outPath)) {
    manifest.push({ name: pretty(name), url: `/textures/pat-${name}.svg` });
  } else {
    console.warn("SKIP (không thấy file):", name);
  }
}

const ts = `// TỰ SINH bởi scripts/wrap-pattern-textures.mjs — đừng sửa tay.
export type PatternTexture = { name: string; url: string };
export const PATTERN_TEXTURES: PatternTexture[] = ${JSON.stringify(
  manifest,
  null,
  2,
)};
`;
writeFileSync("src/components/gallery/patternTextures.ts", ts);
console.log("done:", manifest.length, "textures + manifest");
