import { getCollection, type CollectionEntry } from "astro:content";
import { slugify } from "./taxonomy";

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
