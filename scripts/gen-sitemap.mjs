#!/usr/bin/env node
/**
 * Sinh public/sitemap.xml cho app (giapha.thaohk.com) lúc build.
 *
 * Vì sao: app là SPA, nên không có sitemap thì công cụ tìm kiếm và bot AI (ChatGPT Search, Perplexity, Gemini…)
 * không biết có những trang công khai nào. Sitemap liệt kê: trang tĩnh công khai, MỌI bài hướng dẫn `/docs/<slug>` (lấy
 * từ registry), và MỌI mục Sổ tay Văn hoá đã đăng (đọc từ public/so-tay-data/index.json).
 *
 * Không có VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (build cục bộ) hoặc gọi lỗi → bỏ phần Sổ tay, vẫn ghi phần tĩnh;
 * KHÔNG bao giờ làm hỏng build. Chạy: `node scripts/gen-sitemap.mjs`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.SITE_URL || "https://giapha.thaohk.com";
const today = new Date().toISOString().slice(0, 10);

/** Trang công khai tĩnh: [đường dẫn, độ ưu tiên, tần suất]. */
const STATIC = [
  ["/", 1.0, "weekly"],
  ["/so-tay", 0.9, "weekly"],
  ["/docs", 0.8, "monthly"],
  ["/huong-dan-video", 0.7, "monthly"],
  ["/podcast", 0.5, "weekly"],
  ["/changelog", 0.5, "weekly"],
  ["/lien-he", 0.4, "yearly"],
  ["/chinh-sach-rieng-tu", 0.3, "yearly"],
  ["/dieu-khoan-su-dung", 0.3, "yearly"],
  ["/signup", 0.6, "monthly"],
  ["/login", 0.4, "monthly"],
];

function docSlugs() {
  try {
    const src = readFileSync(join(root, "src/pages/docs/registry.tsx"), "utf8");
    return [...src.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

/** Sổ tay lấy từ public/so-tay-data/index.json (do content-site sinh; xem scripts/ensure-so-tay-data.mjs). */
async function handbookEntries() {
  try {
    const raw = readFileSync(join(root, "public/so-tay-data/index.json"), "utf8");
    const rows = JSON.parse(raw).items ?? [];
    return rows.map((r) => ({ id: r.id, updated_at: r.updated_at }));
  } catch (e) {
    console.warn(`[gen-sitemap] bỏ qua Sổ tay: ${e.message}`);
    return [];
  }
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const entry = (loc, lastmod, changefreq, priority) =>
  `  <url>\n    <loc>${esc(SITE + loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;

const urls = STATIC.map(([p, pr, cf]) => entry(p, today, cf, pr));
for (const slug of docSlugs())
  urls.push(entry(`/docs/${slug}`, today, "monthly", 0.6));
const entries = await handbookEntries();
for (const e of entries) {
  urls.push(
    entry(
      `/xem/so-tay/${e.id}`,
      (e.updated_at || today).slice(0, 10),
      "monthly",
      0.7,
    ),
  );
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public/sitemap.xml"), xml);
console.log(
  `[gen-sitemap] ${urls.length} URL (Sổ tay: ${entries.length}) → public/sitemap.xml`,
);
