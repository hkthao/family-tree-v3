/**
 * Gọi `share-view?part=…` cho trang dòng họ (docs/plan-trang-dong-ho.md, mục 3). Cùng kiểu truy cập với
 * fetchShareView: link token (`?token=`) hoặc dòng họ công khai (`?clan=`), không cần đăng nhập.
 */

export interface SiteAccess {
  token?: string;
  clanId?: string;
}

export type SitePostType = "news" | "event" | "birth" | "death" | "notice";

export interface SitePostItem {
  id: string;
  type: SitePostType;
  title: string;
  excerpt: string;
  /** Ảnh https đầu tiên trong bài (null nếu không có hoặc dòng họ ẩn ảnh). */
  cover: string | null;
  pinned: boolean;
  created_at: string;
  read_minutes: number;
}

export interface SitePage<T> {
  items: T[];
  page: number;
  per: number;
  total: number;
}

export interface SitePost {
  id: string;
  type: SitePostType;
  title: string;
  /** Markdown. */
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  read_minutes: number;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

export interface KhoePayload {
  clan_id: string;
  clan_name: string | null;
  public_tree: boolean;
  card: { title: string; subtitle: string | null; image_path: string; expires_at: string };
}

/** Thiệp khoe /khoe/:token — đọc qua share-view?khoe= (chỉ thiệp còn hạn; lỗi → SitePartError 404). */
export async function fetchKhoe(token: string): Promise<KhoePayload> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${base}/functions/v1/share-view?khoe=${encodeURIComponent(token)}`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new SitePartError(body.error ?? `share-view error (${res.status})`, res.status);
  }
  return (await res.json()) as KhoePayload;
}

export function sitePartUrl(
  base: string,
  access: SiteAccess,
  part: string,
  params: Record<string, string | number | undefined> = {},
): string {
  const qs = new URLSearchParams();
  if (access.token) qs.set("token", access.token);
  else if (access.clanId) qs.set("clan", access.clanId);
  qs.set("part", part);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return `${base}/functions/v1/share-view?${qs.toString()}`;
}

export async function fetchSitePart<T>(
  access: SiteAccess,
  part: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(sitePartUrl(base, access, part, params), {
    method: "GET",
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new SitePartError(body.error ?? `share-view error (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export class SitePartError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const fetchSitePosts = (a: SiteAccess, p: { page?: number; per?: number; type?: string } = {}) =>
  fetchSitePart<SitePage<SitePostItem>>(a, "posts", p);

export const fetchSitePost = (a: SiteAccess, id: string) => fetchSitePart<SitePost>(a, "post", { id });

export interface SiteInfo {
  description: string | null;
  origin_place: string | null;
  ancestral_hall: string | null;
  ancestor_anniversary: string | null;
  chief_name: string | null;
}

export interface SiteHeritageItem {
  id: string;
  category: string;
  title: string;
  summary: string | null;
  location_name: string | null;
  built_year: number | null;
  photo_url: string | null;
}

export interface SiteGrave {
  id: string;
  kind: string;
  name: string | null;
  location_name: string | null;
  status: string;
  built_year: number | null;
  /** Chỉ người ĐÃ MẤT. */
  occupants: string[];
}

export interface SiteHonor {
  id: string;
  honoree_name: string;
  category: string;
  amount: number | null;
  note: string | null;
  occurred_on: string | null;
}

/** Link ảnh trả về dạng đường dẫn (không kèm origin) → ghép với địa chỉ Supabase của app. */
export const siteAssetUrl = (u: string | null | undefined): string | null =>
  !u ? null : u.startsWith("/") ? `${import.meta.env.VITE_SUPABASE_URL}${u}` : u;

export const fetchSiteInfo = (a: SiteAccess) => fetchSitePart<SiteInfo>(a, "info");

export const fetchSiteHeritage = async (a: SiteAccess, p: { page?: number; per?: number; category?: string } = {}) => {
  const r = await fetchSitePart<SitePage<SiteHeritageItem>>(a, "heritage", p);
  return { ...r, items: r.items.map((h) => ({ ...h, photo_url: siteAssetUrl(h.photo_url) })) };
};

export const fetchSiteGraves = (a: SiteAccess, p: { page?: number; per?: number; kind?: string } = {}) =>
  fetchSitePart<SitePage<SiteGrave>>(a, "graves", p);

export const fetchSiteHonor = (a: SiteAccess, p: { page?: number; per?: number; category?: string } = {}) =>
  fetchSitePart<SitePage<SiteHonor>>(a, "honor", p);

export const fetchSiteEvents = (a: SiteAccess) =>
  fetchSitePart<{ items: NonNullable<import("./share-view").ShareViewPayload["events"]> }>(a, "events");

export interface SiteHeritageDetail {
  id: string;
  category: string;
  title: string;
  summary: string | null;
  body: string | null;
  location_name: string | null;
  built_year: number | null;
  photo_urls: string[];
  audios: { url: string; duration_sec: number | null }[];
  videos: { url: string }[];
  people: { full_name: string; gender: "M" | "F"; role_note: string | null }[];
}

export const fetchSiteHeritageItem = async (a: SiteAccess, id: string): Promise<SiteHeritageDetail> => {
  const r = await fetchSitePart<SiteHeritageDetail>(a, "heritage_item", { id });
  return {
    ...r,
    photo_urls: r.photo_urls.map((u) => siteAssetUrl(u) as string),
    audios: r.audios.map((x) => ({ ...x, url: siteAssetUrl(x.url) as string })),
  };
};

export interface SiteMap {
  /** Số người theo mã tỉnh. */
  people: Record<string, number>;
  /** Số nơi an nghỉ theo mã tỉnh. */
  graves: Record<string, number>;
  province_names: Record<string, string>;
}

export const fetchSiteMap = (a: SiteAccess) => fetchSitePart<SiteMap>(a, "map");

export interface SiteMosaic {
  title: string;
  description: string | null;
  cols: number;
  slots: number;
  tiles: { position: number; caption: string | null; photo_url: string | null }[];
}

export const fetchSiteMosaic = async (a: SiteAccess): Promise<SiteMosaic | null> => {
  const r = await fetchSitePart<{ mosaic: SiteMosaic | null }>(a, "mosaic");
  return r.mosaic ? { ...r.mosaic, tiles: r.mosaic.tiles.map((t) => ({ ...t, photo_url: siteAssetUrl(t.photo_url) })) } : null;
};

export interface SiteSearchItem {
  kind: "post" | "heritage" | "grave" | "honor";
  id: string;
  title: string;
  sub?: string;
}

export const fetchSiteSearchIndex = (a: SiteAccess) => fetchSitePart<{ items: SiteSearchItem[] }>(a, "search_index");

export interface SitePersonExtras {
  /** true: người còn sống — chỉ có tên + đời. */
  living: boolean;
  id: string;
  full_name?: string;
  generation?: number | null;
  /** false: link này chưa cho xem tiểu sử / nơi chốn / dấu mốc (khoá `profiles`). */
  profile?: boolean;
  courtesy_name?: string | null;
  posthumous_name?: string | null;
  nickname?: string | null;
  birth_place?: string | null;
  burial_place?: string | null;
  bio?: string | null;
  birth_lunar?: { year: number | null; month: number | null; day: number | null };
  death_lunar?: { year: number | null; month: number | null; day: number | null };
  milestones: { year: number; era: string | null; title: string; body: string | null }[];
  posts: { id: string; type: SitePostType; title: string; created_at: string }[];
  heritage: { id: string; category: string; title: string; role_note: string | null }[];
  graves: { id: string; kind: string; name: string | null; location_name: string | null; status: string }[];
}

export const fetchSitePerson = (a: SiteAccess, id: string) => fetchSitePart<SitePersonExtras>(a, "person", { id });
