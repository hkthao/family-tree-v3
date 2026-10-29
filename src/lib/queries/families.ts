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
  /**
   * Đường dẫn ảnh trong Storage. Tuỳ chọn vì bản ghi nằm sẵn trong cache
   * ở máy người dùng (do bản cũ ghi) chưa có field này.
   */
  photo_path?: string | null;
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
  "id, full_name, gender, is_living, birth_date, death_date, photo_path";

/**
 * Order a person's marriages by explicit rank (vợ cả/hai/ba) then by
 * creation time. NULL `spouse_order` sorts last so unranked marriages
 * keep their old creation order behind the ranked ones. Shared by the
 * relationship query and the family-chart adapter so PersonDetail and
 * the tree agree on spouse order.
 */
export function compareBySpouseOrder(
  a: { spouse_order: number | null; created_at: string | null },
  b: { spouse_order: number | null; created_at: string | null },
): number {
  const oa = a.spouse_order;
  const ob = b.spouse_order;
  if (oa != null && ob != null && oa !== ob) return oa - ob;
  if (oa != null && ob == null) return -1;
  if (oa == null && ob != null) return 1;
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

/**
 * Fetches parents / spouses / children for a person.
 *
 * `source` lets non-members of public clans read through the masked
 * views (mirrors getPerson / getTreeData / listPersons pattern). The
 * raw path uses `persons` + `families` with `deleted_at IS NULL`; the
 * safe path uses `persons_public_safe` + `families_public_safe`, both
 * of which already filter deleted rows internally so we drop the
 * `.is("deleted_at", null)` chain in that branch.
 */
export async function getPersonRelationships(
  personId: string,
  client: Client = defaultClient,
  source: "persons" | "persons_public_safe" = "persons",
): Promise<PersonRelationships> {
  const useSafe = source === "persons_public_safe";

  // 1. Get the person + their birth_family_id
  const meRes = useSafe
    ? await client
        .from("persons_public_safe")
        .select("id, birth_family_id, clan_id")
        .eq("id", personId)
        .maybeSingle()
    : await client
        .from("persons")
        .select("id, birth_family_id, clan_id")
        .eq("id", personId)
        .is("deleted_at", null)
        .maybeSingle();
  if (meRes.error) throw new Error(meRes.error.message);
  const me = meRes.data;
  if (!me) {
    return { parents: [], spouses: [], children: [] };
  }

  // 2. Parents from birth_family
  let parents: Relationship[] = [];
  if (me.birth_family_id) {
    const famRes = useSafe
      ? await client
          .from("families_public_safe")
          .select("husband_id, wife_id")
          .eq("id", me.birth_family_id)
          .maybeSingle()
      : await client
          .from("families")
          .select("husband_id, wife_id")
          .eq("id", me.birth_family_id)
          .is("deleted_at", null)
          .maybeSingle();
    const fam = famRes.data;
    if (fam) {
      const parentIds = [fam.husband_id, fam.wife_id].filter(
        (id): id is string => id !== null,
      );
      if (parentIds.length > 0) {
        const psRes = useSafe
          ? await client
              .from("persons_public_safe")
              .select(PERSON_BRIEF)
              .in("id", parentIds)
          : await client
              .from("persons")
              .select(PERSON_BRIEF)
              .in("id", parentIds)
              .is("deleted_at", null);
        parents = (psRes.data ?? []) as Relationship[];
      }
    }
  }

  // 3. Spouses: families where person is husband_id or wife_id,
  // ordered by spouse_order (vợ cả/hai/ba) then created_at.
  const ownFamRes = useSafe
    ? await client
        .from("families_public_safe")
        .select("id, husband_id, wife_id, spouse_order, created_at")
        .or(`husband_id.eq.${personId},wife_id.eq.${personId}`)
    : await client
        .from("families")
        .select("id, husband_id, wife_id, spouse_order, created_at")
        .or(`husband_id.eq.${personId},wife_id.eq.${personId}`)
        .is("deleted_at", null);
  const ownFamilies = (ownFamRes.data ?? [])
    .slice()
    .sort(compareBySpouseOrder);

  const familyIds = (ownFamilies ?? []).map((f) => f.id);
  const spousePersonIds = (ownFamilies ?? [])
    .map((f) => (f.husband_id === personId ? f.wife_id : f.husband_id))
    .filter((id): id is string => id !== null);

  let spouses: SpouseRelationship[] = [];
  if (spousePersonIds.length > 0) {
    const spRes = useSafe
      ? await client
          .from("persons_public_safe")
          .select(PERSON_BRIEF)
          .in("id", spousePersonIds)
      : await client
          .from("persons")
          .select(PERSON_BRIEF)
          .in("id", spousePersonIds)
          .is("deleted_at", null);
    const byId = new Map(
      (spRes.data ?? []).map((p) => [p.id, p as Relationship]),
    );
    spouses = (ownFamilies ?? [])
      .map((f) => {
        const spouseId = f.husband_id === personId ? f.wife_id : f.husband_id;
        const sp = spouseId ? byId.get(spouseId) : null;
        return sp ? { ...sp, family_id: f.id } : null;
      })
      .filter((s): s is SpouseRelationship => s !== null);
  }

  // 4. Children: persons whose birth_family_id is in our family list
  let children: ChildRelationship[] = [];
  if (familyIds.length > 0) {
    const childCols =
      "id, full_name, gender, is_living, birth_date, death_date, photo_path, birth_family_id";
    const kidsRes = useSafe
      ? await client
          .from("persons_public_safe")
          .select(childCols)
          .in("birth_family_id", familyIds)
          // birth_order ("con thứ mấy") is the explicit Vietnamese
          // sibling rank when set; birth_date is the legacy fallback.
          .order("birth_order", { ascending: true, nullsFirst: false })
          .order("birth_date", { ascending: true, nullsFirst: false })
          .order("full_name", { ascending: true })
      : await client
          .from("persons")
          .select(childCols)
          .in("birth_family_id", familyIds)
          .is("deleted_at", null)
          .order("birth_order", { ascending: true, nullsFirst: false })
          .order("birth_date", { ascending: true, nullsFirst: false })
          .order("full_name", { ascending: true });
    children = (kidsRes.data ?? []).map((k) => ({
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
  birth_lunar_year?: number | null;
  birth_lunar_month?: number | null;
  birth_lunar_day?: number | null;
  birth_lunar_is_leap?: boolean;
  birth_order?: number | null;
  death_date?: string | null;
  death_date_precision?: "day" | "month" | "year" | null;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_lunar_is_leap?: boolean;
  death_anniv_lunar_month?: number | null;
  death_anniv_lunar_day?: number | null;
  death_anniv_lunar_is_leap?: boolean;
}

/** Map AddChildInput → hàng persons (dùng chung cho add 1 và add nhiều). */
function toChildRow(input: AddChildInput) {
  return {
    clan_id: input.clanId,
    full_name: input.full_name,
    gender: input.gender,
    is_living: input.is_living ?? true,
    birth_date: input.birth_date ?? null,
    birth_date_precision:
      input.birth_date_precision ?? (input.birth_date ? "day" : null),
    birth_family_id: input.family_id,
    birth_lunar_year: input.birth_lunar_year ?? null,
    birth_lunar_month: input.birth_lunar_month ?? null,
    birth_lunar_day: input.birth_lunar_day ?? null,
    birth_lunar_is_leap: input.birth_lunar_is_leap ?? false,
    birth_order: input.birth_order ?? null,
    death_date: input.death_date ?? null,
    death_date_precision:
      input.death_date_precision ?? (input.death_date ? "day" : null),
    death_lunar_year: input.death_lunar_year ?? null,
    death_lunar_month: input.death_lunar_month ?? null,
    death_lunar_day: input.death_lunar_day ?? null,
    death_lunar_is_leap: input.death_lunar_is_leap ?? false,
    death_anniv_lunar_month: input.death_anniv_lunar_month ?? null,
    death_anniv_lunar_day: input.death_anniv_lunar_day ?? null,
    death_anniv_lunar_is_leap: input.death_anniv_lunar_is_leap ?? false,
  };
}

export async function addChildToFamily(
  input: AddChildInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("persons")
    .insert(toChildRow(input))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

/**
 * Thêm NHIỀU con trong MỘT request (1 insert nhiều dòng) thay vì lặp N
 * round-trip. Atomic + ít dính timeout/504 hơn hẳn khi mạng yếu (mobile).
 * Tất cả con phải cùng family_id. Trả số lượng đã thêm.
 */
export async function addChildrenToFamily(
  inputs: AddChildInput[],
  client: Client = defaultClient,
): Promise<{ count: number }> {
  if (inputs.length === 0) return { count: 0 };
  const { data, error } = await client
    .from("persons")
    .insert(inputs.map(toChildRow))
    .select("id");
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0 };
}

/**
 * Link an EXISTING person as a child of `familyId`. Companion to
 * `addChildToFamily` (which creates a fresh row); use this when the
 * person already exists in the clan but was attached to the wrong
 * (or no) birth_family.
 *
 * The RPC enforces:
 *   - caller is admin/editor of the clan,
 *   - person + family are in the same clan and both non-deleted,
 *   - person isn't a parent of the target family (no self-as-child),
 *   - no cycle (person isn't an ancestor of either parent).
 */
export async function assignPersonToFamily(
  personId: string,
  familyId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("assign_person_to_family", {
    p_person_id: personId,
    p_family_id: familyId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Pair the focal with an existing clan member as spouse. Server-side:
 *   - validates clan match + opposite genders,
 *   - refuses if spouse is in focal's ancestor OR descendant chain
 *     (no incest cycles),
 *   - returns the family id (existing or freshly created).
 */
export async function assignExistingSpouse(
  personId: string,
  spouseId: string,
  client: Client = defaultClient,
): Promise<string> {
  const { data, error } = await client.rpc("assign_existing_spouse", {
    p_person_id: personId,
    p_spouse_id: spouseId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Set an existing clan member as the focal's father or mother (slot
 * inferred from gender). Server-side:
 *   - validates clan match,
 *   - refuses if parent is in focal's descendant chain — the exact
 *     "ông nội là con của cháu" cycle case,
 *   - reuses focal's current birth_family when present (filling the
 *     husband_id or wife_id slot), otherwise creates a new family and
 *     points focal.birth_family_id at it.
 */
export async function assignExistingParent(
  personId: string,
  parentId: string,
  client: Client = defaultClient,
): Promise<string> {
  const { data, error } = await client.rpc("assign_existing_parent", {
    p_person_id: personId,
    p_parent_id: parentId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Persist the order of a person's marriages. `orderedFamilyIds` is the
 * full spouse list in the desired order (vợ cả first); each family's
 * `spouse_order` is rewritten to its 1-based position so the ranking
 * is dense and unambiguous. Updates run in parallel — the rank lives
 * on the marriage row, so writing it doesn't depend on which partner
 * triggered the reorder.
 */
export async function reorderSpouseFamilies(
  orderedFamilyIds: string[],
  client: Client = defaultClient,
): Promise<void> {
  const results = await Promise.all(
    orderedFamilyIds.map((id, i) =>
      client
        .from("families")
        .update({ spouse_order: i + 1 })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

/**
 * Gỡ liên kết cha / mẹ khi nhập nhầm: bỏ người đó khỏi gia đình sinh ra của
 * `personId` (ô cha hoặc mẹ về trống). Người cha/mẹ đó vẫn còn trong dòng họ,
 * chỉ không còn là cha/mẹ của gia đình này nữa — anh chị em cùng gia đình cũng
 * không còn liên kết với người đó. Cả hai ô trống: gỡ `personId` khỏi gia đình,
 * và xoá gia đình nếu không còn ai khác trong đó.
 */
export async function removeParentLink(
  personId: string,
  parentId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { data: me, error: e1 } = await client
    .from("persons")
    .select("birth_family_id")
    .eq("id", personId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  const famId = me?.birth_family_id;
  if (!famId) return;
  const { data: fam, error: e2 } = await client
    .from("families")
    .select("husband_id, wife_id")
    .eq("id", famId)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!fam) return;
  const husband = fam.husband_id === parentId ? null : fam.husband_id;
  const wife = fam.wife_id === parentId ? null : fam.wife_id;
  const { error: e3 } = await client
    .from("families")
    .update({ husband_id: husband, wife_id: wife })
    .eq("id", famId);
  if (e3) throw new Error(e3.message);
  if (husband === null && wife === null) {
    const { error: e4 } = await client
      .from("persons")
      .update({ birth_family_id: null })
      .eq("id", personId);
    if (e4) throw new Error(e4.message);
    await deleteFamilyIfEmpty(famId, client);
  }
}

/**
 * Gỡ liên kết vợ / chồng khi nhập nhầm. Cuộc hôn nhân chưa có con → xoá hẳn;
 * đã có con → giữ gia đình (để con vẫn thuộc về `personId`), chỉ bỏ người kia.
 */
export async function removeSpouseLink(
  familyId: string,
  personId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { data: fam, error } = await client
    .from("families")
    .select("husband_id, wife_id")
    .eq("id", familyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!fam) return;
  const { count, error: ce } = await client
    .from("persons")
    .select("id", { count: "exact", head: true })
    .eq("birth_family_id", familyId)
    .is("deleted_at", null);
  if (ce) throw new Error(ce.message);
  if ((count ?? 0) === 0) {
    const { error: de } = await client.from("families").delete().eq("id", familyId);
    if (de) throw new Error(de.message);
    return;
  }
  const patch =
    fam.husband_id === personId ? { wife_id: null } : { husband_id: null };
  const { error: ue } = await client.from("families").update(patch).eq("id", familyId);
  if (ue) throw new Error(ue.message);
}

/** Gỡ liên kết con khi nhập nhầm: người con không còn thuộc gia đình đó (không bị xoá). */
export async function removeChildLink(
  childId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("persons")
    .update({ birth_family_id: null })
    .eq("id", childId);
  if (error) throw new Error(error.message);
}

async function deleteFamilyIfEmpty(famId: string, client: Client): Promise<void> {
  const { count } = await client
    .from("persons")
    .select("id", { count: "exact", head: true })
    .eq("birth_family_id", famId)
    .is("deleted_at", null);
  if ((count ?? 0) === 0) await client.from("families").delete().eq("id", famId);
}
