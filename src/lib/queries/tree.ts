import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface PersonForTree {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  birth_date: string | null;
  death_date: string | null;
  generation: number | null;
  birth_family_id: string | null;
  branch_id: string | null;
  photo_path: string | null;
  /** Explicit sibling rank ("con thứ mấy"). 1 = oldest, 2 = next, …
   *  Null when not set — adapter falls back to birth_date sort.
   *  Optional so legacy callers that build PersonForTree without the
   *  new column (Share lineage payload, MyLineage adapter, tests)
   *  still typecheck. */
  birth_order?: number | null;
}

export interface FamilyForTree {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

export interface TreeData {
  persons: PersonForTree[];
  families: FamilyForTree[];
}

/**
 * Hard ceiling — PostgREST's `max_rows` setting (1000 by default on
 * Supabase Cloud / local config.toml) silently truncates the result.
 * Without an explicit `.range()` above that, a 5000-person clan would
 * load with only 1000 persons and 4000 missing nodes drawn as orphans.
 * Set a defensive upper bound that comfortably covers plan §5's
 * 7000-person max with headroom.
 */
const TREE_FETCH_MAX = 9999;

/**
 * Fetch every (non-deleted) person + family in a clan in a single round-trip.
 *
 * Reasonable up to a few thousand persons (each row is small). For very
 * large clans we'll add ancestry/progeny filters at the server level later,
 * but family-chart already prunes via main_id + depth client-side.
 */
export async function getTreeData(
  clanId: string,
  client: Client = defaultClient,
): Promise<TreeData> {
  const [{ data: persons, error: pErr }, { data: families, error: fErr }] = await Promise.all([
    client
      .from("persons")
      .select(
        "id, full_name, gender, is_living, is_root, birth_date, death_date, generation, birth_family_id, branch_id, photo_path, birth_order",
      )
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .range(0, TREE_FETCH_MAX),
    client
      .from("families")
      .select("id, husband_id, wife_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .range(0, TREE_FETCH_MAX),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (fErr) throw new Error(fErr.message);

  return {
    persons: (persons ?? []) as PersonForTree[],
    families: (families ?? []) as FamilyForTree[],
  };
}
