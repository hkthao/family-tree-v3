import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface Relationship {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  birth_date: string | null;
  death_date: string | null;
}

export interface SpouseRelationship extends Relationship {
  family_id: string;
}

export interface ChildRelationship extends Relationship {
  via_family_id: string;
}

export interface PersonRelationships {
  /** Parents from birth_family. 0, 1, or 2 entries. */
  parents: Relationship[];
  /** Every family the person belongs to as husband_id or wife_id. */
  spouses: SpouseRelationship[];
  /** Children: any person whose birth_family_id is one of this person's families. */
  children: ChildRelationship[];
}

const PERSON_BRIEF =
  "id, full_name, gender, is_living, birth_date, death_date";

/**
 * Fetches parents / spouses / children for a person.
 * Three sequential queries — RLS filters them naturally to the caller's clans.
 */
export async function getPersonRelationships(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonRelationships> {
  // 1. Get the person + their birth_family_id
  const { data: me, error: meErr } = await client
    .from("persons")
    .select("id, birth_family_id, clan_id")
    .eq("id", personId)
    .is("deleted_at", null)
    .maybeSingle();
  if (meErr) throw new Error(meErr.message);
  if (!me) {
    return { parents: [], spouses: [], children: [] };
  }

  // 2. Parents from birth_family
  let parents: Relationship[] = [];
  if (me.birth_family_id) {
    const { data: fam } = await client
      .from("families")
      .select("husband_id, wife_id")
      .eq("id", me.birth_family_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (fam) {
      const parentIds = [fam.husband_id, fam.wife_id].filter(
        (id): id is string => id !== null,
      );
      if (parentIds.length > 0) {
        const { data: ps } = await client
          .from("persons")
          .select(PERSON_BRIEF)
          .in("id", parentIds)
          .is("deleted_at", null);
        parents = (ps ?? []) as Relationship[];
      }
    }
  }

  // 3. Spouses: families where person is husband_id or wife_id
  const { data: ownFamilies } = await client
    .from("families")
    .select("id, husband_id, wife_id")
    .or(`husband_id.eq.${personId},wife_id.eq.${personId}`)
    .is("deleted_at", null);

  const familyIds = (ownFamilies ?? []).map((f) => f.id);
  const spousePersonIds = (ownFamilies ?? [])
    .map((f) => (f.husband_id === personId ? f.wife_id : f.husband_id))
    .filter((id): id is string => id !== null);

  let spouses: SpouseRelationship[] = [];
  if (spousePersonIds.length > 0) {
    const { data: spersons } = await client
      .from("persons")
      .select(PERSON_BRIEF)
      .in("id", spousePersonIds)
      .is("deleted_at", null);
    const byId = new Map((spersons ?? []).map((p) => [p.id, p]));
    spouses = (ownFamilies ?? [])
      .map((f) => {
        const spouseId = f.husband_id === personId ? f.wife_id : f.husband_id;
        const sp = spouseId ? byId.get(spouseId) : null;
        return sp ? { ...(sp as Relationship), family_id: f.id } : null;
      })
      .filter((s): s is SpouseRelationship => s !== null);
  }

  // 4. Children: persons whose birth_family_id is in our family list
  let children: ChildRelationship[] = [];
  if (familyIds.length > 0) {
    const { data: kids } = await client
      .from("persons")
      .select("id, full_name, gender, is_living, birth_date, death_date, birth_family_id")
      .in("birth_family_id", familyIds)
      .is("deleted_at", null)
      .order("birth_date", { ascending: true, nullsFirst: false });
    children = (kids ?? []).map((k) => ({
      ...(k as Relationship),
      via_family_id: (k as { birth_family_id: string }).birth_family_id,
    }));
  }

  return { parents, spouses, children };
}

/**
 * Find a family that ties partnerA and partnerB together (regardless of
 * gender ordering), or create one. Returns the family id.
 */
export async function findOrCreateFamily(
  args: {
    clanId: string;
    partnerA: { id: string; gender: "M" | "F" };
    partnerB: { id: string; gender: "M" | "F" } | null;
  },
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const husband =
    args.partnerA.gender === "M"
      ? args.partnerA
      : args.partnerB?.gender === "M"
        ? args.partnerB
        : null;
  const wife =
    args.partnerA.gender === "F"
      ? args.partnerA
      : args.partnerB?.gender === "F"
        ? args.partnerB
        : null;
  const husbandId = husband?.id ?? null;
  const wifeId = wife?.id ?? null;

  // Try to find existing
  let query = client
    .from("families")
    .select("id")
    .eq("clan_id", args.clanId)
    .is("deleted_at", null);
  if (husbandId) query = query.eq("husband_id", husbandId);
  else query = query.is("husband_id", null);
  if (wifeId) query = query.eq("wife_id", wifeId);
  else query = query.is("wife_id", null);

  const { data: existing } = await query.maybeSingle();
  if (existing) return { id: existing.id };

  // Create new
  const { data: created, error } = await client
    .from("families")
    .insert({
      clan_id: args.clanId,
      husband_id: husbandId,
      wife_id: wifeId,
      union_type: "marriage",
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "createFamily failed");
  return { id: created.id };
}

export interface AddChildInput {
  clanId: string;
  family_id: string;
  full_name: string;
  gender: "M" | "F";
  birth_date?: string | null;
  birth_date_precision?: "day" | "month" | "year" | null;
  is_living?: boolean;
}

export async function addChildToFamily(
  input: AddChildInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("persons")
    .insert({
      clan_id: input.clanId,
      full_name: input.full_name,
      gender: input.gender,
      is_living: input.is_living ?? true,
      birth_date: input.birth_date ?? null,
      birth_date_precision:
        input.birth_date_precision ?? (input.birth_date ? "day" : null),
      birth_family_id: input.family_id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}
