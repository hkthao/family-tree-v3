import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { unaccent } from "@/lib/unaccent";
import { CUSTOM_SYNONYMS } from "@/lib/customsSynonyms";

type Client = SupabaseClient<Database>;

export type CustomCategory =
  | "tho_cung"
  | "vong_doi"
  | "le_tet"
  | "le_hoi"
  | "sinh_hoat";
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

export const CUSTOM_CATEGORY_LABEL: Record<CustomCategory, string> = {
  tho_cung: "Thờ cúng & tín ngưỡng",
  vong_doi: "Nghi lễ vòng đời",
  le_tet: "Lễ Tết theo mùa",
  le_hoi: "Lễ hội cộng đồng",
  sinh_hoat: "Phong tục sinh hoạt",
};

export const CUSTOM_SCOPE_LABEL: Record<CustomScope, string> = {
  gia_dinh: "Gia đình",
  dong_ho: "Dòng họ",
  lang_xa: "Làng xã",
  ton_giao: "Tôn giáo",
};

export const CUSTOM_MANDATORY_LABEL: Record<CustomMandatory, string> = {
  bat_buoc: "Bắt buộc",
  khuyen_khich: "Khuyến khích",
  dia_phuong: "Theo phong tục địa phương",
};

export const CUSTOM_ORIGIN_LABEL: Record<CustomOrigin, string> = {
  nho_giao: "Nho giáo",
  phat_giao: "Phật giáo",
  dao_mau: "Đạo Mẫu",
  dan_gian: "Tín ngưỡng dân gian",
  trung_hoa: "Ảnh hưởng Trung Hoa",
  dia_phuong: "Phong tục địa phương",
};

/** Vùng miền phổ biến (regions là text[] mở rộng được, đây là gợi ý sẵn). */
export const CUSTOM_REGIONS = ["Miền Bắc", "Miền Trung", "Miền Nam"] as const;

export interface CustomSection {
  heading: string;
  body: string;
  [k: string]: string;
}
export interface CustomFaq {
  q: string;
  a: string;
  [k: string]: string;
}

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
  origin: CustomOrigin | null;
  reliability: number | null;
  applicable_to: string | null;
  sources: string | null;
  sections: CustomSection[];
  faq: CustomFaq[];
  cover_image_url: string | null;
  status: CustomStatus;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id, title, aliases, short_description, category, regions, lunar_month, timing, scope, mandatory_level, origin, reliability, applicable_to, sources, sections, faq, cover_image_url, status, created_at, updated_at";

function toEntry(r: Record<string, unknown>): CustomEntry {
  return {
    ...(r as unknown as CustomEntry),
    aliases: (r.aliases as string[] | null) ?? [],
    regions: (r.regions as string[] | null) ?? [],
    sections: (r.sections as unknown as CustomSection[]) ?? [],
    faq: (r.faq as unknown as CustomFaq[]) ?? [],
  };
}

export interface ListCustomsParams {
  search?: string;
  category?: CustomCategory | null;
  region?: string | null;
  /** Admin xem cả bản nháp; user thường chỉ published (RLS đã chặn dù sao). */
  includeUnpublished?: boolean;
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

export async function listCustomEntries(
  params: ListCustomsParams = {},
  client: Client = defaultClient,
): Promise<CustomEntry[]> {
  let q = client
    .from("custom_entries")
    .select(COLS)
    .is("deleted_at", null)
    .order("title", { ascending: true });
  if (!params.includeUnpublished) q = q.eq("status", "published");
  if (params.category) q = q.eq("category", params.category);
  if (params.region) q = q.contains("regions", [params.region]);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []).map((r) => toEntry(r as Record<string, unknown>));

  // Tìm theo tình huống/synonym — lọc client trên search_text-like blob.
  const needles = params.search ? expandNeedles(params.search) : [];
  if (needles.length > 0) {
    rows = rows.filter((e) => {
      const hay = unaccent(
        `${e.title} ${e.aliases.join(" ")} ${e.short_description ?? ""} ${e.sections
          .map((s) => `${s.heading} ${s.body}`)
          .join(" ")}`,
      );
      return needles.some((n) => hay.includes(n));
    });
  }
  return rows;
}

export async function getCustomEntry(
  id: string,
  client: Client = defaultClient,
): Promise<CustomEntry | null> {
  const { data, error } = await client
    .from("custom_entries")
    .select(COLS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toEntry(data as Record<string, unknown>) : null;
}

export type CustomEntryInput = Partial<
  Omit<CustomEntry, "id" | "created_at" | "updated_at">
> & { title: string; category: CustomCategory };

export async function createCustomEntry(
  input: CustomEntryInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data: auth } = await client.auth.getUser();
  const { data, error } = await client
    .from("custom_entries")
    .insert({ ...input, created_by: auth.user?.id ?? null } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}

export async function updateCustomEntry(
  id: string,
  patch: Partial<CustomEntryInput>,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("custom_entries")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Soft-delete. */
export async function deleteCustomEntry(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("custom_entries")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Bookmarks ───────────────────────────────────────────────────────────────

export async function listBookmarkedIds(
  client: Client = defaultClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("custom_bookmarks")
    .select("entry_id");
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
    const { error } = await client
      .from("custom_bookmarks")
      .delete()
      .eq("entry_id", entryId);
    if (error) throw new Error(error.message);
  }
}
