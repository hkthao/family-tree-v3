import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * family-chart datum shape. The library wants this exact structure.
 * gender must be "M" or "F" — schema enforces that already.
 *
 * `avatar` is a data-URI SVG that family-chart renders inside the
 * card's image area. The library's default SVG card hard-codes the
 * "genderless" silhouette and ignores gender — supplying an explicit
 * `avatar` is the documented way to override per-row.
 */
export interface F3Datum {
  id: string;
  data: {
    gender: "M" | "F";
    "first name"?: string;
    "last name"?: string;
    "full name": string;
    /** Year of birth (string, 4 digits). */
    birthday?: string;
    /** Year of death (string, 4 digits) — kept separate so onCardUpdate
     *  can render "YYYY - YYYY" / "? - ?" without re-parsing the date. */
    death_year?: string;
    /** Custom — we use it to render the muted "đã mất" footer. */
    is_living?: boolean;
    is_root?: boolean;
    /** 1, 2, 3, … null when unknown. Rendered as a corner badge. */
    generation?: number | null;
    /** SVG data-URI consumed by family-chart's <image href=…/> path. */
    avatar?: string;
  };
  rels: {
    /** At most 2 — birth_family's husband + wife. */
    parents: string[];
    /** Every spouse across every family the person belongs to. */
    spouses: string[];
    /** All persons whose birth_family belongs to any of this person's families. */
    children: string[];
  };
}

/**
 * Per-gender placeholder PNG served from /public. family-chart's SVG
 * card uses <image href=…/> when `data.avatar` is set, which trumps
 * the library's default genderless silhouette.
 */
function genderAvatar(gender: "M" | "F"): string {
  return gender === "M" ? "/avatars/male.png" : "/avatars/female.png";
}

/**
 * Build a person-relationship view that's easy to consume from React
 * components: for each person, who are their parents / spouses / children.
 *
 * Source of truth:
 * - parents  ← from `persons.birth_family_id` → families.husband_id/wife_id
 * - spouses  ← all families where person is husband_id OR wife_id
 * - children ← persons whose birth_family_id ∈ this person's families
 */
export function toFamilyChart(
  persons: PersonForTree[],
  families: FamilyForTree[],
  /**
   * Map of `photo_path` → signed URL for persons who have uploaded a
   * photo. If a person isn't in the map (or their photo_path is null),
   * the card falls back to the gendered illustration.
   */
  photoUrlByPath?: Map<string, string>,
): F3Datum[] {
  const familyById = new Map(families.map((f) => [f.id, f]));

  // For each person, find the families they belong to as a partner.
  const familiesOf = new Map<string, FamilyForTree[]>();
  for (const f of families) {
    for (const pid of [f.husband_id, f.wife_id]) {
      if (!pid) continue;
      const arr = familiesOf.get(pid) ?? [];
      arr.push(f);
      familiesOf.set(pid, arr);
    }
  }

  // Children index: family_id → list of child person ids
  const childrenByFamily = new Map<string, string[]>();
  for (const p of persons) {
    if (!p.birth_family_id) continue;
    const arr = childrenByFamily.get(p.birth_family_id) ?? [];
    arr.push(p.id);
    childrenByFamily.set(p.birth_family_id, arr);
  }

  return persons.map((p) => {
    const parents: string[] = [];
    if (p.birth_family_id) {
      const fam = familyById.get(p.birth_family_id);
      if (fam) {
        if (fam.husband_id) parents.push(fam.husband_id);
        if (fam.wife_id) parents.push(fam.wife_id);
      }
    }

    const myFamilies = familiesOf.get(p.id) ?? [];
    const spouses = myFamilies
      .map((f) => (f.husband_id === p.id ? f.wife_id : f.husband_id))
      .filter((id): id is string => id !== null);
    const children = myFamilies.flatMap(
      (f) => childrenByFamily.get(f.id) ?? [],
    );

    const uploaded =
      p.photo_path && photoUrlByPath?.get(p.photo_path);
    return {
      id: p.id,
      data: {
        gender: p.gender,
        "full name": p.full_name,
        birthday: p.birth_date?.slice(0, 4),
        death_year: p.death_date?.slice(0, 4),
        is_living: p.is_living,
        is_root: p.is_root,
        generation: p.generation,
        avatar: uploaded || genderAvatar(p.gender),
      },
      rels: { parents, spouses, children },
    } satisfies F3Datum;
  });
}

/**
 * Pick a sensible default focal person: prefer an `is_root` person if one
 * exists (the Thuỷ tổ — the natural root of the tree). Otherwise fall back
 * to the person with the smallest known generation, then to the first row.
 */
export function pickDefaultFocal(persons: PersonForTree[]): string | null {
  if (persons.length === 0) return null;
  const root = persons.find((p) => p.is_root);
  if (root) return root.id;
  const withGen = persons
    .filter((p) => p.generation !== null)
    .sort((a, b) => (a.generation ?? 99) - (b.generation ?? 99));
  if (withGen.length > 0) return withGen[0].id;
  return persons[0].id;
}
