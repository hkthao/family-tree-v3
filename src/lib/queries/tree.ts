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
        "id, full_name, gender, is_living, is_root, birth_date, death_date, generation, birth_family_id",
      )
      .eq("clan_id", clanId)
      .is("deleted_at", null),
    client
      .from("families")
      .select("id, husband_id, wife_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (fErr) throw new Error(fErr.message);

  return {
    persons: (persons ?? []) as PersonForTree[],
    families: (families ?? []) as FamilyForTree[],
  };
}
