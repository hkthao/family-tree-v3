/**
 * Direct-line ancestry tracing for the "Đường trực hệ — Từ tôi về
 * thuỷ tổ" page.
 *
 * Given the full set of persons + families for a clan and a starting
 * person ID, walk up the tree one generation at a time. At each step
 * we go to the birth_family and pick either the husband (father) or
 * wife (mother) as the next ancestor. Vietnamese tradition is patri-
 * lineal so we default to the father, but per-step overrides are
 * supported via the `choices` map so users can also walk maternal
 * branches.
 *
 * Stopping conditions:
 *  - The current person has no birth_family_id → end of recorded line.
 *  - The chosen parent slot is empty (e.g. user picked "via mother" but
 *    the family has no wife_id) → end of recorded line.
 *  - The current person has is_root=true → end of recorded line.
 *  - We've already visited this person (cycle guard) → end of line.
 *
 * Pure function: no IO, no React. Easy to unit-test.
 */

export type LineageVia = "paternal" | "maternal";

export interface LineagePerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  generation: number | null;
  birth_family_id: string | null;
  birth_date: string | null;
  death_date: string | null;
  photo_path: string | null;
  courtesy_name?: string | null;
}

export interface LineageFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

export interface LineageStep {
  person: LineagePerson;
  /**
   * Which parent slot this person occupies in the child's birth
   * family. 'self' for the starting person; 'father' or 'mother' for
   * the picked ancestor at each higher generation.
   */
  arrivedVia: "self" | "father" | "mother";
  /**
   * Whether the child below has both parents recorded — controls
   * whether the UI lets the user toggle paternal/maternal at this
   * step. Always undefined for the starting "self" entry.
   */
  bothParentsAvailable?: boolean;
}

export interface LineageResult {
  /** Ordered self → root. Length 1 means no parents recorded. */
  steps: LineageStep[];
  /** True if traversal ended at a person with is_root = true. */
  reachedRoot: boolean;
  /**
   * The id of the immediate child at each step that had both parents
   * available. The lineage page uses this to render the per-step
   * paternal/maternal toggle for that child.
   */
  forkPoints: string[];
}

/**
 * Build the lineage line.
 *
 * @param persons     Every (non-deleted) person in the clan.
 * @param families    Every (non-deleted) family in the clan.
 * @param fromId      The starting person — usually the user's self.
 * @param choices     Optional per-child override: `choices[childId]`
 *                    says which parent to follow up from that child.
 *                    Defaults to 'paternal' when unset.
 */
export function traceLineage(
  persons: LineagePerson[],
  families: LineageFamily[],
  fromId: string,
  choices: Record<string, LineageVia> = {},
): LineageResult {
  const personById = new Map(persons.map((p) => [p.id, p]));
  const familyById = new Map(families.map((f) => [f.id, f]));

  const start = personById.get(fromId);
  if (!start) {
    return { steps: [], reachedRoot: false, forkPoints: [] };
  }

  const steps: LineageStep[] = [{ person: start, arrivedVia: "self" }];
  const forkPoints: string[] = [];
  const visited = new Set<string>([start.id]);
  let cursor: LineagePerson = start;
  let reachedRoot = start.is_root;

  while (!reachedRoot) {
    if (!cursor.birth_family_id) break;
    const family = familyById.get(cursor.birth_family_id);
    if (!family) break;

    const bothParents = !!(family.husband_id && family.wife_id);
    if (bothParents) forkPoints.push(cursor.id);

    const via: LineageVia = choices[cursor.id] ?? "paternal";
    const parentId =
      via === "paternal" ? family.husband_id : family.wife_id;
    if (!parentId) break;
    if (visited.has(parentId)) break; // cycle guard

    const parent = personById.get(parentId);
    if (!parent) break;

    steps.push({
      person: parent,
      arrivedVia: via === "paternal" ? "father" : "mother",
      bothParentsAvailable: bothParents,
    });
    visited.add(parent.id);
    cursor = parent;
    if (parent.is_root) {
      reachedRoot = true;
      break;
    }
  }

  return { steps, reachedRoot, forkPoints };
}
