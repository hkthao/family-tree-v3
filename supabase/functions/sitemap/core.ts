/**
 * sitemap — bản đồ trang cho các trang dòng họ CÔNG KHAI (docs/plan-trang-dong-ho.md). sitemap.xml tĩnh của app không biết dòng họ nào
 * công khai (cần đọc DB lúc chạy) nên function này sinh động và máy chủ web trỏ `/sitemap-dong-ho.xml` tới đây.
 *
 * Quyền riêng tư: CHỈ liệt kê dòng họ visibility=public + public_show_tree, và chỉ các trang CẤP DÒNG HỌ mà admin đã bật
 * (trang chủ, Bảng tin + từng bài đã đăng, Sự kiện, Di sản + từng mục đang hoạt động, Mộ phần, Bảng vàng). KHÔNG đẩy trang cây và
 * hồ sơ từng người (tên người) vào sitemap — công cụ tìm kiếm vẫn có thể tự tìm thấy qua liên kết, nhưng ta không chủ động quảng bá.
 * Không import Deno-only nên test được bằng vitest.
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

/** Giới hạn của một tệp sitemap theo chuẩn là 50.000 URL; chừa dư. */
export const MAX_URLS = 45_000;
const PER_TABLE_CAP = 20_000;

export interface SitemapClan {
  id: string;
  share_sections: string[] | null;
  updated_at: string | null;
}
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const day = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined);
const PAGES: [string, string][] = [["events", "su-kien"], ["graves", "mo-phan"], ["honor", "bang-vang"]];

export function buildEntries(
  origin: string,
  clans: SitemapClan[],
  posts: { id: string; clan_id: string; updated_at: string | null }[],
  items: { id: string; clan_id: string; updated_at: string | null }[],
): SitemapEntry[] {
  const base = origin.replace(/\/+$/, "");
  const out: SitemapEntry[] = [];
  const by = <T extends { clan_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.clan_id, [...(m.get(r.clan_id) ?? []), r]);
    return m;
  };
  const postsBy = by(posts);
  const itemsBy = by(items);
  for (const c of clans) {
    const s = c.share_sections ?? [];
    const root = `${base}/xem/clans/${c.id}`;
    out.push({ loc: root, lastmod: day(c.updated_at) });
    if (s.includes("board")) {
      out.push({ loc: `${root}/bang-tin` });
      for (const p of postsBy.get(c.id) ?? []) out.push({ loc: `${root}/bang-tin/${p.id}`, lastmod: day(p.updated_at) });
    }
    if (s.includes("heritage")) {
      out.push({ loc: `${root}/di-san` });
      for (const h of itemsBy.get(c.id) ?? []) out.push({ loc: `${root}/di-san/${h.id}`, lastmod: day(h.updated_at) });
    }
    for (const [key, seg] of PAGES) if (s.includes(key)) out.push({ loc: `${root}/${seg}` });
  }
  return out.slice(0, MAX_URLS);
}

export function toXml(entries: SitemapEntry[]): string {
  const rows = entries.map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

export async function loadSitemap(sb: Sb, origin: string): Promise<string> {
  const { data: clans, error } = await sb.from("clans").select("id, share_sections, updated_at").eq("visibility", "public").eq("public_show_tree", true).order("created_at").limit(5000);
  if (error) throw new Error(error.message);
  const rows = (clans ?? []) as SitemapClan[];
  const boardIds = rows.filter((c) => (c.share_sections ?? []).includes("board")).map((c) => c.id);
  const heritageIds = rows.filter((c) => (c.share_sections ?? []).includes("heritage")).map((c) => c.id);
  const [posts, items] = await Promise.all([
    boardIds.length ? sb.from("clan_posts").select("id, clan_id, updated_at").in("clan_id", boardIds).eq("status", "published").order("created_at", { ascending: false }).limit(PER_TABLE_CAP) : { data: [], error: null },
    heritageIds.length ? sb.from("heritage_items").select("id, clan_id, updated_at").in("clan_id", heritageIds).eq("status", "active").is("deleted_at", null).order("created_at", { ascending: false }).limit(PER_TABLE_CAP) : { data: [], error: null },
  ]);
  if (posts.error) throw new Error(posts.error.message);
  if (items.error) throw new Error(items.error.message);
  return toXml(buildEntries(origin, rows, posts.data ?? [], items.data ?? []));
}
