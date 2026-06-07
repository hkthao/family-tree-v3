import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
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

export interface ClanBookData {
  persons: PersonDetail[];
  families: ClanBookFamily[];
  branches: ClanBookBranch[];
  /** child_id → family_id (their birth family). */
  childToFamily: Record<string, string>;
}

const DETAIL_COLS =
  "id, clan_id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id, courtesy_name, posthumous_name, nickname, bio, birth_place, burial_place, photo_path, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day, death_anniv_lunar_month, death_anniv_lunar_day";

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
  const [pq, fq, bq] = await Promise.all([
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
  ]);

  if (pq.error) throw new Error(pq.error.message);
  if (fq.error) throw new Error(fq.error.message);
  if (bq.error) throw new Error(bq.error.message);

  const persons = (pq.data ?? []) as (PersonDetail & {
    birth_family_id: string | null;
  })[];
  const childToFamily: Record<string, string> = {};
  for (const p of persons) {
    if (p.birth_family_id) childToFamily[p.id] = p.birth_family_id;
  }

  return {
    persons: persons.map(({ birth_family_id: _b, ...rest }) => rest as PersonDetail),
    families: (fq.data ?? []) as ClanBookFamily[],
    branches: (bq.data ?? []) as ClanBookBranch[],
    childToFamily,
  };
}
