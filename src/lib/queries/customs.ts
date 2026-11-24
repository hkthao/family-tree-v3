import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { unaccent } from "@/lib/unaccent";
import { CUSTOM_SYNONYMS } from "@/lib/customsSynonyms";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";

type Client = SupabaseClient<Database>;

export type CustomCategory =
  | "tho_cung"
  | "vong_doi"
  | "le_tet"
  | "le_hoi"
  | "sinh_hoat"
  | "van_khan";
export type CustomScope = "gia_dinh" | "dong_ho" | "lang_xa" | "ton_giao";
export type CustomMandatory = "bat_buoc" | "khuyen_khich" | "dia_phuong";
export type CustomOrigin =
  | "nho_giao"
  | "phat_giao"
  | "dao_mau"
  | "dan_gian"
  | "trung_hoa"
  | "dia_phuong";
export type CustomStatus = "draft" | "needs_review" | "published";

export const CUSTOM_CATEGORY_LABEL: Record<CustomCategory, string> = lazyMessages({
  tho_cung: msg`Thờ cúng & tín ngưỡng`,
  vong_doi: msg`Nghi lễ vòng đời`,
  le_tet: msg`Lễ Tết theo mùa`,
  le_hoi: msg`Lễ hội cộng đồng`,
  sinh_hoat: msg`Phong tục sinh hoạt`,
  van_khan: msg`Văn khấn & văn tế`,
}) as Record<CustomCategory, string>;

export const CUSTOM_SCOPE_LABEL: Record<CustomScope, string> = lazyMessages({
  gia_dinh: msg`Gia đình`,
  dong_ho: msg`Dòng họ`,
  lang_xa: msg`Làng xã`,
  ton_giao: msg`Tôn giáo`,
}) as Record<CustomScope, string>;

export const CUSTOM_MANDATORY_LABEL: Record<CustomMandatory, string> = lazyMessages({
  bat_buoc: msg`Bắt buộc`,
  khuyen_khich: msg`Khuyến khích`,
  dia_phuong: msg`Theo phong tục địa phương`,
}) as Record<CustomMandatory, string>;

export const CUSTOM_ORIGIN_LABEL: Record<CustomOrigin, string> = lazyMessages({
  nho_giao: msg`Nho giáo`,
  phat_giao: msg`Phật giáo`,
  dao_mau: msg`Đạo Mẫu`,
  dan_gian: msg`Tín ngưỡng dân gian`,
  trung_hoa: msg`Ảnh hưởng Trung Hoa`,
  dia_phuong: msg`Phong tục địa phương`,
}) as Record<CustomOrigin, string>;

/** Vùng miền phổ biến (regions là text[] mở rộng được, đây là gợi ý sẵn). */
export const CUSTOM_REGIONS = ["Miền Bắc", "Miền Trung", "Miền Nam"] as const;

/** Thân bài: `body` là HTML (do content-site sinh từ Markdown), luôn làm sạch bằng DOMPurify trước khi hiển thị. */
export interface CustomSection {
  heading: string;
  body: string;
}
export interface CustomFaq {
  q: string;
  a: string;
}
export interface CustomSource {
  name: string;
  url?: string;
}

export interface CustomTag {
  slug: string;
  name: string;
}

/**
 * Bài Sổ tay Văn hoá. Nguồn là tệp (content-site/content/so-tay/*.md) → public/so-tay-data/*.json; KHÔNG còn bảng DB.
 * `id` là slug bài. Danh sách (index.json) không kèm `sections`/`faq`; getCustomEntry mới trả đủ.
 */
export interface CustomEntry {
  id: string;
  title: string;
  aliases: string[];
  short_description: string | null;
  category: CustomCategory;
  regions: string[];
  lunar_month: number | null;
  timing: string | null;
  scope: CustomScope | null;
  mandatory_level: CustomMandatory | null;
  origins: CustomOrigin[];
  related_ids: string[];
  reliability: number | null;
  applicable_to: string | null;
  sources: CustomSource[];
  sections: CustomSection[];
  faq: CustomFaq[];
  tags: CustomTag[];
  cover_image_url: string | null;
  /** Trang SEO công khai của bài (landing). */
  page_url: string | null;
  status: CustomStatus;
  created_at: string;
  updated_at: string;
}

/** Bản rút gọn để chọn/hiển thị bài liên quan. */
export interface CustomEntryLite {
  id: string;
  title: string;
  category: CustomCategory;
}

const DATA_BASE = "/so-tay-data";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}/${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Không tải được ${path} (${res.status})`);
  return (await res.json()) as T;
}

type IndexRow = Record<string, unknown> & { id: string };

function toEntry(r: IndexRow): CustomEntry {
  const x = r as Record<string, unknown>;
  return {
    id: r.id,
    title: String(x.title ?? ""),
    aliases: (x.aliases as string[] | undefined) ?? [],
    short_description: (x.short_description as string | null | undefined) ?? null,
    category: x.category as CustomCategory,
    regions: (x.regions as string[] | undefined) ?? [],
    lunar_month: (x.lunar_month as number | null | undefined) ?? null,
    timing: (x.timing as string | null | undefined) ?? null,
    scope: (x.scope as CustomScope | null | undefined) ?? null,
    mandatory_level: (x.mandatory_level as CustomMandatory | null | undefined) ?? null,
    origins: (x.origins as CustomOrigin[] | undefined) ?? [],
    related_ids: (x.related_ids as string[] | undefined) ?? [],
    reliability: (x.reliability as number | null | undefined) ?? null,
    applicable_to: (x.applicable_to as string | null | undefined) ?? null,
    sources: (x.sources as CustomSource[] | undefined) ?? [],
    sections: (x.sections as CustomSection[] | undefined) ?? [],
    faq: (x.faq as CustomFaq[] | undefined) ?? [],
    tags: (x.tags as CustomTag[] | undefined) ?? [],
    cover_image_url: (x.cover_image_url as string | null | undefined) ?? null,
    page_url: (x.page_url as string | null | undefined) ?? null,
    status: "published",
    created_at: String(x.updated_at ?? ""),
    updated_at: String(x.updated_at ?? ""),
  };
}

// Mục lục và văn bản toàn văn chỉ tải một lần mỗi phiên (cache theo Promise; lỗi thì bỏ cache để thử lại).
let indexPromise: Promise<CustomEntry[]> | null = null;
let fulltextPromise: Promise<Record<string, string>> | null = null;

function loadIndex(): Promise<CustomEntry[]> {
  indexPromise ??= fetchJson<{ items: IndexRow[] }>("index.json")
    .then((d) => d.items.map(toEntry))
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

function loadFulltext(): Promise<Record<string, string>> {
  fulltextPromise ??= fetchJson<Record<string, string>>("fulltext.json").catch((e) => {
    fulltextPromise = null;
    throw e;
  });
  return fulltextPromise;
}

/** Danh sách bài (id, title, category). */
export async function listCustomEntriesLite(): Promise<CustomEntryLite[]> {
  const all = await loadIndex();
  return all.map(({ id, title, category }) => ({ id, title, category }));
}

/** Lấy các bài theo danh sách id (cho mục "Bài liên quan" ở trang xem), giữ đúng thứ tự. */
export async function getCustomEntriesByIds(ids: string[]): Promise<CustomEntryLite[]> {
  if (ids.length === 0) return [];
  const all = await loadIndex();
  const byId = new Map(all.map((e) => [e.id, e]));
  return ids
    .map((id) => byId.get(id))
    .filter((x): x is CustomEntry => !!x)
    .map(({ id, title, category }) => ({ id, title, category }));
}

export interface ListCustomsParams {
  search?: string;
  category?: CustomCategory | null;
  region?: string | null;
}

/** Mở rộng từ khoá tìm bằng synonym + bỏ dấu. Export để test. */
export function expandNeedles(search: string): string[] {
  const base = unaccent(search);
  if (!base) return [];
  const extra = new Set<string>([base]);
  for (const [key, alts] of Object.entries(CUSTOM_SYNONYMS)) {
    const all = [key, ...alts].map(unaccent);
    if (all.some((t) => t.includes(base) || base.includes(t))) {
      all.forEach((t) => extra.add(t));
    }
  }
  return [...extra];
}

export async function listCustomEntries(params: ListCustomsParams = {}): Promise<CustomEntry[]> {
  let rows = [...(await loadIndex())].sort((a, b) => a.title.localeCompare(b.title, "vi"));
  if (params.category) rows = rows.filter((e) => e.category === params.category);
  if (params.region) rows = rows.filter((e) => e.regions.includes(params.region as string));

  // Tìm theo tình huống/synonym, không dấu: tiêu đề + tên gọi khác + mô tả + thẻ ở mục lục; toàn văn tải khi cần.
  const needles = params.search ? expandNeedles(params.search) : [];
  if (needles.length > 0) {
    const full = await loadFulltext().catch(() => ({}) as Record<string, string>);
    rows = rows.filter((e) => {
      const hay =
        full[e.id] ??
        unaccent(`${e.title} ${e.aliases.join(" ")} ${e.short_description ?? ""} ${e.tags.map((t) => t.name).join(" ")}`);
      return needles.some((n) => hay.includes(n));
    });
  }
  return rows;
}

export async function getCustomEntry(id: string): Promise<CustomEntry | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return toEntry(await fetchJson<IndexRow>(`${id}.json`));
  } catch {
    return null;
  }
}

// ── Bookmarks (vẫn lưu DB theo người dùng; entry_id là slug bài) ────────────

export async function listBookmarkedIds(client: Client = defaultClient): Promise<Set<string>> {
  const { data, error } = await client.from("custom_bookmarks").select("entry_id");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.entry_id as string));
}

export async function setBookmark(
  entryId: string,
  on: boolean,
  client: Client = defaultClient,
): Promise<void> {
  if (on) {
    const { data: auth } = await client.auth.getUser();
    const { error } = await client
      .from("custom_bookmarks")
      .upsert({ entry_id: entryId, user_id: auth.user!.id } as never);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("custom_bookmarks").delete().eq("entry_id", entryId);
    if (error) throw new Error(error.message);
  }
}

/**
 * Truy vấn Sổ tay đọc từ tệp tĩnh (đổi theo mỗi lần deploy) nên KHÔNG lưu bền vào IndexedDB: cache cũ giữ đường dẫn ảnh/id
 * của bản trước và, vì refetchOnMount tắt, không bao giờ tự làm mới. Bookmark là dữ liệu theo người dùng nên vẫn lưu.
 */
const STATIC_CUSTOMS_KEYS = new Set(["customs", "custom-entry", "custom-related", "customs-published-lite", "customs-embed"]);
export function isStaticCustomsQuery(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && STATIC_CUSTOMS_KEYS.has(queryKey[0]);
}
