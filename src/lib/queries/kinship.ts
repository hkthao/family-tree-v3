import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { KinshipPerson } from "@/lib/kinship";

type Client = SupabaseClient<Database>;

/**
 * Pull every person + family for the clan and assemble the
 * KinshipPerson lookup map computeKinship() expects.
 *
 * Same defensive .range() cap as other "fetch all" queries — clans
 * up to ~10k persons load in one round-trip without hitting the
 * PostgREST max_rows ceiling.
 */
export async function getKinshipIndex(
  clanId: string,
  client: Client = defaultClient,
): Promise<{
  byId: Map<string, KinshipPerson>;
  ordered: KinshipPerson[];
}> {
  const MAX_ROWS = 9999;
  const [pq, fq] = await Promise.all([
    client
      .from("persons")
      .select("id, full_name, gender, birth_date, birth_family_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true })
      .range(0, MAX_ROWS),
    client
      .from("families")
      .select("id, husband_id, wife_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .range(0, MAX_ROWS),
  ]);
  if (pq.error) throw new Error(pq.error.message);
  if (fq.error) throw new Error(fq.error.message);

  const rawPersons = (pq.data ?? []) as {
    id: string;
    full_name: string;
    gender: "M" | "F";
    birth_date: string | null;
    birth_family_id: string | null;
  }[];
  const families = (fq.data ?? []) as {
    id: string;
    husband_id: string | null;
    wife_id: string | null;
  }[];

  const familyById = new Map(families.map((f) => [f.id, f]));

  const ordered: KinshipPerson[] = rawPersons.map((p) => {
    const fam = p.birth_family_id ? familyById.get(p.birth_family_id) : null;
    return {
      id: p.id,
      full_name: p.full_name,
      gender: p.gender,
      birth_year: p.birth_date ? Number(p.birth_date.slice(0, 4)) : null,
      father_id: fam?.husband_id ?? null,
      mother_id: fam?.wife_id ?? null,
    };
  });
  const byId = new Map(ordered.map((p) => [p.id, p]));
  return { byId, ordered };
}
