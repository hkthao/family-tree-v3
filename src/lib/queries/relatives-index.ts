import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface RelativesIndexPerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
}

export interface RelativesIndex {
  /** id → name/gender for spouse + parent lookups. */
  byId: Map<string, RelativesIndexPerson>;
  /** Person id → father id (from `birth_family_id.husband_id`). */
  fatherOf: Map<string, string>;
  /** Person id → mother id (from `birth_family_id.wife_id`). */
  motherOf: Map<string, string>;
  /** Person id → list of spouse ids (from families where they're husband or wife). */
  spousesOf: Map<string, string[]>;
}

/**
 * Clan-wide lookup tables for father / mother / spouse names, built
 * from a single pull of every (non-deleted) person id+name and every
 * family in the clan. Sized for clans up to a few thousand persons.
 *
 * Used by Danh bạ to enrich each row with family relations without
 * issuing one query per person.
 */
export async function getRelativesIndex(
  clanId: string,
  client: Client = defaultClient,
): Promise<RelativesIndex> {
  // Same defensive cap as getTreeData — PostgREST max_rows truncates
  // silently at 1000 by default, which would leave a 5000-person
  // Danh bạ with most parent/spouse columns unfilled.
  const MAX_ROWS = 9999;
  const [pq, fq] = await Promise.all([
    client
      .from("persons")
      .select("id, full_name, gender, birth_family_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
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

  const persons = (pq.data ?? []) as {
    id: string;
    full_name: string;
    gender: "M" | "F";
    birth_family_id: string | null;
  }[];
  const families = (fq.data ?? []) as {
    id: string;
    husband_id: string | null;
    wife_id: string | null;
  }[];

  const byId = new Map<string, RelativesIndexPerson>(
    persons.map((p) => [
      p.id,
      { id: p.id, full_name: p.full_name, gender: p.gender },
    ]),
  );
  const familyById = new Map(families.map((f) => [f.id, f]));

  const fatherOf = new Map<string, string>();
  const motherOf = new Map<string, string>();
  for (const p of persons) {
    if (!p.birth_family_id) continue;
    const fam = familyById.get(p.birth_family_id);
    if (!fam) continue;
    if (fam.husband_id) fatherOf.set(p.id, fam.husband_id);
    if (fam.wife_id) motherOf.set(p.id, fam.wife_id);
  }

  const spousesOf = new Map<string, string[]>();
  for (const fam of families) {
    if (fam.husband_id && fam.wife_id) {
      pushTo(spousesOf, fam.husband_id, fam.wife_id);
      pushTo(spousesOf, fam.wife_id, fam.husband_id);
    }
  }

  return { byId, fatherOf, motherOf, spousesOf };
}

function pushTo<K, V>(m: Map<K, V[]>, key: K, value: V) {
  const arr = m.get(key);
  if (arr) arr.push(value);
  else m.set(key, [value]);
}
