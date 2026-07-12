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

export interface ClanBookData {
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
  const [pq, fq, bq, rq, hq, honq] = await Promise.all([
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
    persons: persons.map(({ birth_family_id: _b, ...rest }) => rest as PersonDetail),
    families: (fq.data ?? []) as ClanBookFamily[],
    branches: (bq.data ?? []) as ClanBookBranch[],
    restingPlaces,
    heritage,
    honor,
    childToFamily,
  };
}
