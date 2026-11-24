#!/usr/bin/env node
/**
 * Xuất bài Sổ tay đang nằm trong bảng custom_entries (DB) sang content/so-tay/*.md — chạy MỘT LẦN khi chuyển nguồn.
 *
 *   Cách A (REST):  SUPABASE_URL=<url API> SUPABASE_SERVICE_ROLE_KEY=<khoá> node scripts/export-db.mjs [--overwrite]
 *   Cách B (tệp):   node scripts/export-db.mjs --file entries.json [--overwrite]
 *                   entries.json = mảng JSON các dòng custom_entries (vd dump bằng psql qua SSH, không cần khoá service-role):
 *                   ssh <máy DB> "docker exec -i <container db> psql -U postgres -d postgres -At -c \"select coalesce(json_agg(t),'[]') from (select * from custom_entries where deleted_at is null) t\"" > entries.json
 *
 * --overwrite ghi đè tệp cùng slug NGOẠI TRỪ bài giàu nội dung (có infobox / ảnh / đoạn mở bài viết tay, vd 10 bài lễ hội và 7 bài hướng dẫn):
 * những bài đó được giữ nguyên và in cảnh báo.
 *
 * Cần khoá service-role vì phải lấy cả bài nháp / chờ duyệt (khoá anon chỉ thấy bài published). KHÔNG đặt URL/khoá thật
 * vào repo; truyền qua biến môi trường. Kết quả:
 *   - content/so-tay/<slug>.md           mỗi bài một tệp (giữ nguyên status); tệp đã có thì bỏ qua trừ khi --overwrite
 *   - .export/id-map.json                uuid → slug (cho bookmark, link chia sẻ cũ /xem/so-tay/<uuid>)
 *   - .export/bookmarks-to-slug.sql      câu UPDATE đổi custom_bookmarks.entry_id từ uuid sang slug (chạy SAU migration
 *                                        20261125100000_so_tay_static_source.sql)
 * Bài trùng chủ đề với bài đã viết tay: khai báo ở MERGE bên dưới để ánh xạ uuid sang bài đó thay vì tạo tệp mới.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "content/so-tay");
const exp = join(root, ".export");
const overwrite = process.argv.includes("--overwrite");
const fileArg = process.argv.includes("--file") ? process.argv[process.argv.indexOf("--file") + 1] : null;
/** Bài viết tay (có infobox / ảnh / đoạn mở bài `lead`, những trường bản DB không có) không được ghi đè; bài seed thì được. */
const isRich = (f) => existsSync(f) && (() => { const fm = readFileSync(f, "utf8").split(/^---$/m)[1] ?? ""; return /^(infobox|images):\s*$/m.test(fm) || /^lead:\s*\S/m.test(fm); })();
const MERGE = { "Lễ Vu Lan báo hiếu": "le-vu-lan" };

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!fileArg && (!url || !key)) {
  console.error("Thiếu --file <entries.json> hoặc cặp SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMd = (t) => esc(t ?? "").replace(/\n(?!\n)/g, "  \n");

let rows;
if (fileArg) {
  rows = JSON.parse(readFileSync(fileArg, "utf8"));
  if (!Array.isArray(rows)) throw new Error("entries.json phải là một mảng");
} else {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/custom_entries?select=*&deleted_at=is.null&order=title.asc&limit=2000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    process.exit(1);
  }
  rows = await res.json();
}
rows.sort((a, b) => a.title.localeCompare(b.title, "vi"));

// Gán slug trước (để đổi related_ids sang slug ở lượt sau).
const idToSlug = {};
const used = new Set();
for (const r of rows) {
  let s = MERGE[r.title] ?? (slugify(r.title.replace(/\(.*?\)/g, "")) || slugify(r.title));
  // Địa chỉ rút gọn quá ngắn (vd "Ngày giỗ (Giỗ đầu, …)" → "ngay-gio", dễ nhầm với "ngày giờ") thì dùng tiêu đề đầy đủ.
  if (!MERGE[r.title] && s.length < 12) s = slugify(r.title);
  // Trùng địa chỉ với bài viết tay (vd "Tết Nguyên Đán (Giao thừa…)" → tet-nguyen-dan): lấy slug từ TIÊU ĐỀ ĐẦY ĐỦ để không mất bài.
  if (!MERGE[r.title] && isRich(join(out, `${s}.md`))) {
    const full = slugify(r.title);
    console.warn(`địa chỉ "${s}" đã là bài viết tay → bài "${r.title}" dùng địa chỉ "${full}"`);
    s = full;
  }
  if (!MERGE[r.title]) {
    const base = s;
    for (let i = 2; used.has(s); i++) s = `${base}-${i}`;
    used.add(s);
  }
  idToSlug[r.id] = s;
}

mkdirSync(out, { recursive: true });
mkdirSync(exp, { recursive: true });
let wrote = 0;
let skipped = 0;
for (const r of rows) {
  if (MERGE[r.title]) {
    console.log(`gộp "${r.title}" → ${MERGE[r.title]} (không tạo tệp)`);
    continue;
  }
  const slug = idToSlug[r.id];
  const file = join(out, `${slug}.md`);
  if (isRich(file)) {
    skipped++;
    console.warn(`GIỮ NGUYÊN bài viết tay (giàu nội dung), KHÔNG ghi đè: ${slug}  ← bài "${r.title}" trong DB trùng địa chỉ, kiểm tra thủ công`);
    continue;
  }
  if (existsSync(file) && !overwrite) {
    skipped++;
    console.log(`bỏ qua (đã có): ${slug}`);
    continue;
  }
  const body = (r.sections ?? [])
    .map((s) => `## ${s.heading}\n\n${s.image_url ? `<figure><img src="${s.image_url}" alt="${esc(s.image_caption ?? s.heading)}" loading="lazy" />${s.image_caption ? `<figcaption>${esc(s.image_caption)}</figcaption>` : ""}</figure>\n\n` : ""}${toMd(s.body)}\n`)
    .join("\n");
  const fm = {
    status: r.status,
    title: r.title,
    description: r.short_description || r.title,
    updated: (r.updated_at || new Date().toISOString()).slice(0, 10),
    category: r.category,
    tags: r.regions ?? [],
    aliases: r.aliases ?? [],
    regions: r.regions ?? [],
    lunar_month: r.lunar_month ?? null,
    timing: r.timing || undefined,
    scope: r.scope ?? null,
    mandatory_level: r.mandatory_level ?? null,
    origins: r.origins ?? (r.origin ? [r.origin] : []),
    reliability: r.reliability ?? null,
    applicable_to: r.applicable_to || undefined,
    cover_image_url: r.cover_image_url || undefined,
    faq: r.faq ?? [],
    related: (r.related_ids ?? []).map((id) => idToSlug[id]).filter(Boolean),
    sources: r.sources ? [{ name: r.sources }] : [],
  };
  writeFileSync(file, `---\n${YAML.stringify(fm, { lineWidth: 0, aliasDuplicateObjects: false })}---\n\n${body}`);
  wrote++;
}

writeFileSync(join(exp, "id-map.json"), JSON.stringify(idToSlug, null, 2));
const values = Object.entries(idToSlug).map(([id, slug]) => `  ('${id}', '${slug}')`).join(",\n");
writeFileSync(
  join(exp, "bookmarks-to-slug.sql"),
  `-- Chạy SAU migration 20261125100000_so_tay_static_source.sql. Bookmark trỏ bài không còn sẽ bị xoá ở bước cuối.\n` +
    `update public.custom_bookmarks b set entry_id = m.slug\n  from (values\n${values}\n  ) as m(id, slug)\n where b.entry_id = m.id;\n` +
    `delete from public.custom_bookmarks where entry_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-';\n`,
);
console.log(`Đã ghi ${wrote} tệp, bỏ qua ${skipped}; id-map + SQL bookmark ở content-site/.export/`);
