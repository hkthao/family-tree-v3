import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { HonorEntry } from "@/lib/queries/honor";
import type { PersonDetail } from "@/lib/queries/persons";

type Client = SupabaseClient<Database>;

export interface ClanBookFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

export interface ClanBookBranch {
  id: string;
  name: string;
}

export interface ClanBookRestingPlace {
  id: string;
  kind: "grave" | "ashes_temple" | "columbarium" | "scattered" | "other";
  name: string | null;
  location_name: string | null;
  location_detail: string | null;
  address: string | null;
  status: "existing" | "relocated" | "lost";
  occupant_names: string[];
  cover_path: string | null;
}

export interface ClanBookHeritage {
  id: string;
  category: "place" | "custom" | "story" | "artifact";
  title: string;
  summary: string | null;
  body: string | null;
  location_name: string | null;
  built_year: number | null;
  people_names: string[];
  /** Ảnh bìa: đường dẫn bucket (cần ký) hoặc link ngoài (dùng trực tiếp). */
  cover_path: string | null;
  cover_url: string | null;
}

/** Văn bản tự soạn của sổ gia phả (bảng clan_book_texts). */
export interface ClanBookTexts {
  place_line: string | null;
  preface: string | null;
  phaky: string | null;
  ngoai_pha: string | null;
  phu_khao: string | null;
  origin_place: string | null;
  ancestral_hall: string | null;
  ancestor_anniversary: string | null;
  chief_name: string | null;
  compilers: string | null;
  compiled_year: string | null;
  contact: string | null;
}

export const BOOK_TEXT_COLS = "place_line, preface, phaky, ngoai_pha, phu_khao, origin_place, ancestral_hall, ancestor_anniversary, chief_name, compilers, compiled_year, contact";

export const EMPTY_BOOK_TEXTS: ClanBookTexts = {
  place_line: null,
  preface: null,
  phaky: null,
  ngoai_pha: null,
  phu_khao: null,
  origin_place: null,
  ancestral_hall: null,
  ancestor_anniversary: null,
  chief_name: null,
  compilers: null,
  compiled_year: null,
  contact: null,
};

export async function getClanBookTexts(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanBookTexts | null> {
  const { data, error } = await client
    .from("clan_book_texts")
    .select(BOOK_TEXT_COLS)
    .eq("clan_id", clanId)
    .maybeSingle();
  // Bảng chưa có (chưa áp migration) hoặc lỗi đọc: sổ vẫn xuất được, chỉ
  // thiếu phần văn bản tự soạn.
  if (error) return null;
  return (data as ClanBookTexts | null) ?? null;
}

/** Bỏ khoảng trắng; ô trống thành null. Giữ cả khoá null để lưu được việc xoá chữ. */
export function cleanBookTexts(t: Partial<ClanBookTexts>): Partial<ClanBookTexts> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(t)) out[k] = v && v.trim() ? v.trim() : null;
  // Chỉ có ô trống hết thì không cần ghi (dùng khi tạo mới).
  return out as Partial<ClanBookTexts>;
}

/** Ghi từng cột được truyền, không đụng cột khác (form thông tin và form văn bản cùng một dòng). */
export async function saveClanBookTexts(
  clanId: string,
  texts: Partial<ClanBookTexts>,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clan_book_texts")
    .upsert({ clan_id: clanId, ...texts }, { onConflict: "clan_id" });
  if (error) throw new Error(error.message);
}

export interface ClanBookData {
  /** Lời nói đầu, phả ký, ngoại phả, phụ khảo do dòng họ tự soạn. */
  texts?: ClanBookTexts | null;
  persons: PersonDetail[];
  families: ClanBookFamily[];
  branches: ClanBookBranch[];
  restingPlaces: ClanBookRestingPlace[];
  heritage: ClanBookHeritage[];
  /** Bảng vàng công đức — vinh danh đóng góp/thành tích. */
  honor: HonorEntry[];
  /** child_id → family_id (their birth family). */
  childToFamily: Record<string, string>;
}

const DETAIL_COLS =
  "id, clan_id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id, courtesy_name, posthumous_name, nickname, bio, birth_place, burial_place, photo_path, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day, death_anniv_lunar_month, death_anniv_lunar_day, lifespan_years, birth_order";

/**
 * One-shot bulk fetch for PDF / GEDCOM export.
 *
 * Pulls every non-deleted person with full PersonDetail fields, every
 * family, every branch, plus a child→family map (read from the
 * birth_family_id column on persons). Sized for clans up to ~5000
 * persons; larger trees should paginate.
 */
export async function getClanBookData(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanBookData> {
  // PostgREST's max_rows (1000 by default) silently truncates list
  // queries. Used by PDF export + GEDCOM — both want every row,
  // not the first 1000. Same defensive ceiling as getTreeData.
  const MAX_ROWS = 9999;
  const [pq, fq, bq, rq, hq, honq, texts] = await Promise.all([
    client
      .from("persons")
      .select(`${DETAIL_COLS}, birth_family_id`)
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .order("generation", { ascending: true, nullsFirst: false })
      .order("birth_date", { ascending: true, nullsFirst: false })
      .range(0, MAX_ROWS),
    client
      .from("families")
      .select("id, husband_id, wife_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .range(0, MAX_ROWS),
    client
      .from("branches")
      .select("id, name")
      .eq("clan_id", clanId)
      .order("name")
      .range(0, MAX_ROWS),
    client
      .from("resting_places")
      .select(
        "id, kind, name, location_name, location_detail, address, status, resting_place_occupants(person:persons(full_name)), resting_place_photos(path, sort)",
      )
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(0, MAX_ROWS),
    client
      .from("heritage_items")
      .select(
        "id, category, title, summary, body, location_name, built_year, cover_media_id, heritage_people(person:persons(full_name)), heritage_media!heritage_media_item_id_fkey(id, kind, path, external_url, sort)",
      )
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true })
      .range(0, MAX_ROWS),
    client
      .from("honor_entries")
      .select(
        "id, clan_id, person_id, honoree_name, category, amount, note, occurred_on, created_at",
      )
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(0, MAX_ROWS),
    getClanBookTexts(clanId, client),
  ]);

  if (pq.error) throw new Error(pq.error.message);
  if (fq.error) throw new Error(fq.error.message);
  if (bq.error) throw new Error(bq.error.message);
  if (rq.error) throw new Error(rq.error.message);
  if (hq.error) throw new Error(hq.error.message);
  if (honq.error) throw new Error(honq.error.message);

  const persons = (pq.data ?? []) as (PersonDetail & {
    birth_family_id: string | null;
  })[];
  const childToFamily: Record<string, string> = {};
  for (const p of persons) {
    if (p.birth_family_id) childToFamily[p.id] = p.birth_family_id;
  }

  // deno-lint shape: occupants embed → flat name list.
  const restingPlaces: ClanBookRestingPlace[] = (rq.data ?? []).map((r) => {
    const occ = (r as { resting_place_occupants?: { person: { full_name: string } | null }[] }).resting_place_occupants ?? [];
    const photos = ((r as { resting_place_photos?: { path: string; sort: number }[] }).resting_place_photos ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort);
    const { resting_place_occupants: _o, resting_place_photos: _p, ...rest } =
      r as ClanBookRestingPlace & { resting_place_occupants?: unknown; resting_place_photos?: unknown };
    return {
      ...(rest as Omit<ClanBookRestingPlace, "occupant_names" | "cover_path">),
      occupant_names: occ.map((o) => o.person?.full_name).filter((n): n is string => !!n),
      cover_path: photos[0]?.path ?? null,
    };
  });

  const heritage: ClanBookHeritage[] = (hq.data ?? []).map((h) => {
    const hh = h as {
      cover_media_id: string | null;
      heritage_people?: { person: { full_name: string } | null }[];
      heritage_media?: { id: string; kind: string; path: string | null; external_url: string | null; sort: number }[];
    };
    const ppl = hh.heritage_people ?? [];
    const photos = (hh.heritage_media ?? [])
      .filter((m) => m.kind === "photo")
      .sort((a, b) => a.sort - b.sort);
    const cover = photos.find((p) => p.id === hh.cover_media_id) ?? photos[0] ?? null;
    const { heritage_people: _p, heritage_media: _m, cover_media_id: _c, ...rest } =
      h as ClanBookHeritage & { heritage_people?: unknown; heritage_media?: unknown; cover_media_id?: unknown };
    return {
      ...(rest as Omit<ClanBookHeritage, "people_names" | "cover_path" | "cover_url">),
      people_names: ppl.map((x) => x.person?.full_name).filter((n): n is string => !!n),
      cover_path: cover?.path ?? null,
      cover_url: cover?.external_url ?? null,
    };
  });

  const honor: HonorEntry[] = (honq.data ?? []).map((r) => ({
    ...(r as HonorEntry),
    amount: r.amount == null ? null : Number(r.amount),
  }));

  return {
    texts,
    persons: persons.map(({ birth_family_id: _b, ...rest }) => rest as PersonDetail),
    families: (fq.data ?? []) as ClanBookFamily[],
    branches: (bq.data ?? []) as ClanBookBranch[],
    restingPlaces,
    heritage,
    honor,
    childToFamily,
  };
}
