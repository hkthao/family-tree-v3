import { getCollection, type CollectionEntry } from "astro:content";
import { APP_CHANNELS, channelOfCategory, slugify } from "./taxonomy";

export type Article = CollectionEntry<"soTay">;

/** Chỉ bài đã published mới ra web/app (draft, needs_review ở lại trong repo). */
export async function published(): Promise<Article[]> {
  const all = await getCollection("soTay", (e) => e.data.status === "published");
  return all.sort((a, b) => a.data.title.localeCompare(b.data.title, "vi"));
}

export const shortName = (a: Article) => a.data.short ?? a.data.title;
export const isoDate = (a: Article) => a.data.updated.toISOString().slice(0, 10);

export function tagIndex(articles: Article[]) {
  const map = new Map<string, { slug: string; name: string; items: Article[] }>();
  for (const a of articles)
    for (const t of a.data.tags) {
      const slug = slugify(t);
      if (!map.has(slug)) map.set(slug, { slug, name: t, items: [] });
      map.get(slug)!.items.push(a);
    }
  return [...map.values()].sort((x, y) => y.items.length - x.items.length || x.name.localeCompare(y.name, "vi"));
}

export interface Cover {
  src: string;
  alt: string;
}

/** Ảnh bìa: ảnh đầu của bài lễ hội (đã tải về landing/assets/le-hoi), hoặc ảnh bìa ngoài; không có thì null (hiện nền màu). */
export function coverOf(a: Article): Cover | null {
  const im = a.data.images[0];
  if (im) return { src: `/assets/le-hoi/${im.file}`, alt: im.alt };
  if (a.data.cover_image_url) return { src: a.data.cover_image_url, alt: a.data.title };
  return null;
}

/** Số phút đọc: dùng `minutes` nếu bài khai báo, không thì ước từ độ dài thân bài (≈ 200 từ/phút). */
export function readingMinutes(a: Article): number {
  if (a.data.minutes) return a.data.minutes;
  const words = (a.body ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const dateVi = (a: Article) => isoDate(a).split("-").reverse().join("/");

/** Số bài mỗi trang ở trang chuyên mục/thẻ; số bài mỗi nhóm ở trang chủ Blog. Đặt SO_TAY_PAGE_SIZE để thử phân trang. */
export const PAGE_SIZE = Number(process.env.SO_TAY_PAGE_SIZE) || 8;
export const HUB_PER_GROUP = Number(process.env.SO_TAY_HUB_PER_GROUP) || 6;

/** Cắt danh sách thành các trang (luôn có ít nhất 1 trang, kể cả khi rỗng). */
export function paginate<T>(items: T[], size = PAGE_SIZE): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** Địa chỉ một trang: trang 1 là `${base}.html`, trang n là `${base}/trang-n.html`. */
export const pageHref = (base: string, n: number) => (n <= 1 ? `${base}.html` : `${base}/trang-${n}.html`);

/** Chuyên mục của bài (suy ra từ danh mục) và địa chỉ trang bài: <base chuyên mục>/<slug>.html. */
export const channelOf = (a: Article) => channelOfCategory(a.data.category);
export const postHref = (a: Article) => `${channelOf(a).base}/${a.id}.html`;

/** Bài xuất sang app (mục Sổ tay trong app): chỉ các chuyên mục APP_CHANNELS. */
export async function forApp(): Promise<Article[]> {
  return (await published()).filter((a) => APP_CHANNELS.includes(channelOf(a).slug));
}

/** Mới → cũ (cùng ngày thì theo tiêu đề). */
export const byNewest = (all: Article[]) =>
  [...all].sort((a, b) => b.data.updated.getTime() - a.data.updated.getTime() || a.data.title.localeCompare(b.data.title, "vi"));

/** Gợi ý ổn định giữa các lần build (không ngẫu nhiên thật, để HTML không đổi vô cớ): xếp theo băm của slug + khoá. */
export function suggested(all: Article[], n: number, exclude: Article[] = [], salt = ""): Article[] {
  const h = (s: string) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
  return all.filter((a) => !exclude.includes(a)).sort((a, b) => h(a.id + salt) - h(b.id + salt)).slice(0, n);
}
