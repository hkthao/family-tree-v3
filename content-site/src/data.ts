import { marked } from "marked";
import type { Article } from "./lib";
import { categoryName, slugify } from "./taxonomy";
import { postHref } from "./lib";

export const SITE = "https://donghoviet.thaohk.com";

/** Bỏ dấu + hạ chữ thường, khớp `unaccent` trong app để tìm không dấu. */
export function unaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

/**
 * Dữ liệu này do APP đọc (origin khác landing): ảnh bài lễ hội được chép kèm vào so-tay-data/img/ và phục vụ cùng origin
 * với app (không phụ thuộc landing đã deploy ảnh hay chưa); liên kết tương đối khác trỏ về site landing.
 */
const IMG = "/so-tay-data/img/";
const absolutize = (html: string) =>
  html
    .replace(/(src)="\/assets\/le-hoi\//g, `$1="${IMG}`)
    .replace(/(src|href)="\/(?!\/|so-tay-data\/)/g, `$1="${SITE}/`);

export function sectionsOf(a: Article): { heading: string; body: string }[] {
  const parts = (a.body ?? "").split(/^## +/m);
  const out: { heading: string; body: string }[] = [];
  const intro = parts.shift()?.trim();
  if (intro) out.push({ heading: "", body: absolutize(marked.parse(intro, { async: false }) as string) });
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const heading = (nl < 0 ? p : p.slice(0, nl)).trim();
    const body = nl < 0 ? "" : p.slice(nl + 1).trim();
    out.push({ heading, body: absolutize(marked.parse(body, { async: false }) as string) });
  }
  return out;
}

export function metaOf(a: Article) {
  const g = a.data;
  const img = g.images[0] ? `${IMG}${g.images[0].file}` : g.cover_image_url ?? null;
  return {
    id: a.id,
    title: g.title,
    aliases: g.aliases,
    short_description: g.description,
    category: g.category,
    category_name: categoryName(g.category),
    regions: g.regions,
    lunar_month: g.lunar_month ?? null,
    timing: g.timing ?? g.when ?? null,
    scope: g.scope ?? null,
    mandatory_level: g.mandatory_level ?? null,
    origins: g.origins,
    reliability: g.reliability ?? null,
    tags: g.tags.map((t) => ({ slug: slugify(t), name: t })),
    cover_image_url: img,
    updated_at: g.updated.toISOString().slice(0, 10),
    page_url: `${SITE}${postHref(a)}`,
  };
}
