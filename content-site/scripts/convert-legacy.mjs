#!/usr/bin/env node
/**
 * Chuyển nội dung cũ sang content/so-tay/*.md (chạy một lần, có thể chạy lại — ghi đè):
 *   1. 10 bài lễ hội JSON (scripts/landing-guides/le-hoi/*.json)
 *   2. 15 bài seed Sổ tay (scripts/seed-customs.ts), status needs_review (chưa ra web/app cho tới khi duyệt)
 * Bài đang có trên DB prod: dùng scripts/export-db.mjs (cần khoá đọc), không dùng tệp này.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..");
const out = join(root, "content/so-tay");
mkdirSync(out, { recursive: true });
const today = new Date().toISOString().slice(0, 10);

function slugify(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const write = (slug, fm, body) =>
  writeFileSync(join(out, `${slug}.md`), `---\n${YAML.stringify(fm, { lineWidth: 0 })}---\n\n${body}`);

// ── 1. Bài lễ hội ──────────────────────────────────────────────────────────
const META = {
  "hoi-den-hung": { category: "le_hoi", month: 3, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Phú Thọ", "Vua Hùng", "Tháng Ba âm lịch", "Di tích quốc gia đặc biệt"], aliases: ["giỗ tổ hùng vương", "giỗ tổ", "vua hùng", "đền hùng"] },
  "hoi-chua-huong": { category: "le_hoi", month: 1, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Hà Nội", "Quan Âm", "Tháng Giêng âm lịch", "Phật giáo"], aliases: ["trẩy hội chùa hương", "đi chùa hương", "hương sơn", "du xuân"] },
  "le-vu-lan": { category: "le_tet", month: 7, regions: ["Miền Bắc", "Miền Trung", "Miền Nam"], tags: ["Cả nước", "Báo hiếu", "Tháng Bảy âm lịch", "Phật giáo", "Tổ tiên"], aliases: ["rằm tháng bảy", "báo hiếu", "cài hoa hồng", "xá tội vong nhân"] },
  "le-hoi-den-chem": { category: "le_hoi", month: 5, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Hà Nội", "Lý Ông Trọng", "Tháng Năm âm lịch", "Di sản phi vật thể quốc gia"], aliases: ["đình chèm", "lý ông trọng", "hội chèm"] },
  "le-hoi-duc-thanh-tran": { category: "le_hoi", month: 8, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Hải Phòng", "Ninh Bình", "Trần Hưng Đạo", "Tháng Tám âm lịch"], aliases: ["kiếp bạc", "bảo lộc", "hưng đạo vương", "tháng tám giỗ cha"] },
  "le-hoi-thanh-giong": { category: "le_hoi", month: 4, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Hà Nội", "Thánh Gióng", "Tháng Tư âm lịch", "UNESCO"], aliases: ["hội gióng", "phù đổng thiên vương", "phù đổng", "đền sóc"] },
  "tet-nguyen-dan": { category: "le_tet", month: 1, regions: ["Miền Bắc", "Miền Trung", "Miền Nam"], tags: ["Cả nước", "Tháng Giêng âm lịch", "Mâm cúng", "Tổ tiên"], aliases: ["tết", "tết ta", "năm mới", "tết cổ truyền"], extraRelated: ["giao-thua"] },
  "hoi-lim": { category: "le_hoi", month: 1, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Bắc Ninh", "Quan họ", "Tháng Giêng âm lịch", "UNESCO"], aliases: ["quan họ", "hát quan họ", "hội lim bắc ninh"] },
  "hoi-chua-keo": { category: "le_hoi", month: 1, regions: ["Miền Bắc"], tags: ["Miền Bắc", "Hưng Yên", "Dương Không Lộ", "Tháng Giêng âm lịch", "Tháng Chín âm lịch"], aliases: ["chùa keo", "thần quang tự", "dương không lộ"] },
  "le-via-ba-chua-xu": { category: "le_hoi", month: 4, regions: ["Miền Nam"], tags: ["Miền Nam", "An Giang", "Bà Chúa Xứ", "Tháng Tư âm lịch", "UNESCO"], aliases: ["núi sam", "châu đốc", "vía bà", "miếu bà chúa xứ"] },
};
const fig = (im) => `<figure><img src="/assets/le-hoi/${im.file}" alt="${im.alt}" width="${im.w}" height="${im.h}" loading="lazy" /><figcaption>${im.caption} · Ảnh: ${im.credit}</figcaption></figure>\n\n`;
for (const [slug, m] of Object.entries(META)) {
  const d = JSON.parse(readFileSync(join(repo, "scripts/landing-guides/le-hoi", `${slug}.json`), "utf8"));
  const body = d.sections.map((s) => `## ${s.h2}\n\n${s.image != null && d.images[s.image] ? fig(d.images[s.image]) : ""}${s.html.trim()}\n`).join("\n");
  write(slug, {
    status: "published", title: d.title, short: d.short, description: d.description, updated: d.updated,
    category: m.category, tags: m.tags, aliases: m.aliases, regions: m.regions, lunar_month: m.month, timing: d.when,
    minutes: d.minutes, when: d.when, where: d.where, lead: d.lead,
    infobox: d.infobox.map(([label, value]) => ({ label, value })), images: d.images, faq: d.faq, heritage: d.heritage,
    related: [...d.related, ...(m.extraRelated ?? [])], sources: d.sources,
  }, body);
}
console.log("lễ hội:", Object.keys(META).length);

// ── 2. Seed Sổ tay ─────────────────────────────────────────────────────────
const src = readFileSync(join(repo, "scripts/seed-customs.ts"), "utf8");
const start = src.indexOf("const ENTRIES: Row[] = [") + "const ENTRIES: Row[] = ".length;
const end = src.lastIndexOf("];") + 1;
const sec = (heading, body) => ({ heading, body });
const ENTRIES = new Function("sec", `return ${src.slice(start, end)};`)(sec);
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMd = (t) => esc(t).replace(/\n(?!\n)/g, "  \n");
const SKIP = new Set(["Lễ Vu Lan báo hiếu"]); // đã có bài đầy đủ hơn: le-vu-lan
let n = 0;
for (const e of ENTRIES) {
  if (SKIP.has(e.title)) continue;
  const slug = slugify(e.title.replace(/\(.*?\)/g, "")) || slugify(e.title);
  const body = (e.sections ?? [])
    .map((s) => `## ${s.heading}\n\n${s.image_url ? `<figure><img src="${s.image_url}" alt="${esc(s.image_caption ?? s.heading)}" loading="lazy" />${s.image_caption ? `<figcaption>${esc(s.image_caption)}</figcaption>` : ""}</figure>\n\n` : ""}${toMd(s.body)}\n`)
    .join("\n");
  write(slug, {
    status: "needs_review", title: e.title, description: e.short_description ?? e.title, updated: today,
    category: e.category, tags: [...(e.regions ?? [])], aliases: e.aliases ?? [], regions: e.regions ?? [],
    lunar_month: e.lunar_month ?? null, timing: e.timing ?? undefined, scope: e.scope ?? null, mandatory_level: e.mandatory_level ?? null,
    origins: e.origins ?? (e.origin ? [e.origin] : []), reliability: e.reliability ?? null, applicable_to: e.applicable_to ?? undefined,
    cover_image_url: e.cover_image_url ?? undefined, faq: e.faq ?? [],
    sources: e.sources ? [{ name: e.sources }] : [],
  }, body);
  n++;
}
console.log("seed:", n, "(needs_review)");
