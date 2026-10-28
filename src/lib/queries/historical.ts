/**
 * Dòng họ lịch sử (gia phả vua chúa, quý tộc, quan lại, võ tướng) — xem
 * docs/plan-gia-pha-vua-chua.md. Đọc trị vì, tước hiệu, trích dẫn nguồn và
 * cha mẹ nuôi của một người; danh sách dòng họ lịch sử cho trang Cộng đồng.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type HistoricalCategory = "royal" | "noble" | "official" | "military";
export type Confidence = "confirmed" | "single_source" | "disputed" | "legendary";

export const HISTORICAL_CATEGORY_LABEL: Record<HistoricalCategory, string> = {
  royal: "Hoàng tộc",
  noble: "Quý tộc",
  official: "Quan lại – khoa bảng",
  military: "Võ tướng",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: "Khớp nhiều nguồn",
  single_source: "Một nguồn",
  disputed: "Dị bản",
  legendary: "Truyền thuyết",
};

export const REIGN_ROLE_LABEL: Record<string, string> = {
  emperor: "Vua",
  retired_emperor: "Thái thượng hoàng",
  lord: "Chúa",
  regent: "Nhiếp chính",
};

export interface Reign {
  id: string;
  dynasty: string;
  ordinal: number | null;
  role: string;
  temple_name: string | null;
  era_names: { name: string; from_year?: number | null; to_year?: number | null }[];
  reign_start_year: number | null;
  reign_end_year: number | null;
  notes: string | null;
}

export interface Title {
  id: string;
  title: string;
  from_year: number | null;
  to_year: number | null;
  notes: string | null;
}

export interface Citation {
  id: string;
  field: string;
  value: string | null;
  locator: string;
  quote: string;
  confidence: Confidence;
  note: string | null;
  reviewed_by: string | null;
  source: { code: string; title: string; tier: string; url: string | null } | null;
}

export interface AdoptiveParent {
  person_id: string;
  full_name: string | null;
  role: "father" | "mother";
}

export interface PersonHistorical {
  reigns: Reign[];
  titles: Title[];
  citations: Citation[];
  adoptiveParents: AdoptiveParent[];
}

export async function getPersonHistorical(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonHistorical> {
  const [reigns, titles, citations, adoptive] = await Promise.all([
    client
      .from("person_reigns")
      .select("id, dynasty, ordinal, role, temple_name, era_names, reign_start_year, reign_end_year, notes")
      .eq("person_id", personId)
      .order("sort"),
    client
      .from("person_titles")
      .select("id, title, from_year, to_year, notes")
      .eq("person_id", personId)
      .order("sort"),
    client
      .from("person_citations")
      .select("id, field, value, locator, quote, confidence, note, reviewed_by, source:historical_sources(code, title, tier, url)")
      .eq("person_id", personId)
      .order("created_at"),
    client.rpc("get_person_adoptive_parents", { p_person_id: personId }),
  ]);
  for (const r of [reigns, titles, citations, adoptive]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    reigns: (reigns.data ?? []) as unknown as Reign[],
    titles: (titles.data ?? []) as Title[],
    citations: (citations.data ?? []) as unknown as Citation[],
    adoptiveParents: (adoptive.data ?? []) as AdoptiveParent[],
  };
}

/**
 * Tiểu sử, tên tự/húy/thụy, nơi sinh/an táng, ngày âm của một người đã mất
 * trong dòng họ lịch sử công khai — share-view không trả các trường này ở
 * trang xem thử. Dòng họ khác / người còn sống → null.
 */
export async function getHistoricalPersonExtras(
  personId: string,
  client: Client = defaultClient,
): Promise<Database["public"]["Functions"]["get_historical_person_extras"]["Returns"][number] | null> {
  const { data, error } = await client.rpc("get_historical_person_extras", { p_person_id: personId });
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/** Dòng họ có nguồn sử liệu không — để trang xem thử công khai bật tab "Chi tiết". */
export async function clanHasSources(clanId: string, client: Client = defaultClient): Promise<boolean> {
  const { data, error } = await client.from("person_citations").select("id").eq("clan_id", clanId).limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export interface HistoricalClanSummary {
  id: string;
  name: string;
  description: string | null;
  person_count: number;
  historical_category: HistoricalCategory | null;
}

/** Dòng họ lịch sử công khai — mục "Gia phả lịch sử" ở tab Cộng đồng. */
export async function listHistoricalClans(
  client: Client = defaultClient,
): Promise<HistoricalClanSummary[]> {
  const { data, error } = await client
    .from("clans")
    .select("id, name, description, person_count, historical_category")
    .eq("kind", "historical")
    .eq("visibility", "public")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as HistoricalClanSummary[];
}

/** Nhãn tiếng Việt cho trường của trích dẫn ("reign:0" → "Trị vì"). */
export function citationFieldLabel(field: string, titles: Title[] = []): string {
  const [base, idx] = field.split(":");
  if (base === "title") {
    const t = titles[Number(idx)];
    return t ? `Tước hiệu: ${t.title}` : "Tước hiệu";
  }
  return (
    {
      existence: "Có chép trong sử",
      full_name: "Họ tên",
      nickname: "Tên húy",
      courtesy_name: "Tên tự",
      posthumous_name: "Tên thụy",
      birth: "Ngày sinh",
      death: "Ngày mất",
      lifespan: "Tuổi thọ",
      parents: "Cha mẹ",
      adoptive_parents: "Cha mẹ nuôi / thừa tự",
      birth_place: "Nơi sinh",
      burial_place: "Nơi an táng",
      birth_order: "Con thứ mấy",
      bio: "Tiểu sử",
      reign: "Trị vì",
    } as Record<string, string>
  )[base] ?? field;
}

/** "âm 1394-12-15" → "15/12/1394 âm lịch"; "âm ?-4-3" → "3/4 âm lịch"; "âm 1255" → "năm 1255 (âm lịch)". */
export function formatCitationValue(value: string): string {
  const m = /^âm ([\d?]+)(?:-(\d+)(n?))?(?:-(\d+))?$/.exec(value);
  if (!m) return value;
  const [, y, mo, leap, d] = m;
  const month = mo ? `${mo}${leap ? " nhuận" : ""}` : null;
  if (y === "?") return `${d ? `${d}/` : "tháng "}${month} âm lịch`;
  if (!month) return `năm ${y} (âm lịch)`;
  if (!d) return `tháng ${month} năm ${y} (âm lịch)`;
  return `${d}/${month}/${y} âm lịch`;
}
