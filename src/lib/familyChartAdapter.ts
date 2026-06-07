import type { InlawGhostSpouse } from "@/lib/queries/person-links";
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
    /** Ghost-spouse fields. Set ONLY on synthetic nodes representing a
     *  spouse who lives in a peer clan via a confirmed inlaw link. The
     *  tree's onCardUpdate hook styles these with a dashed border + a
     *  "Họ X" tag and routes clicks to the inlaw badge dialog. */
    is_ghost?: boolean;
    ghost_link_id?: string;
    ghost_peer_clan_name?: string;
    ghost_local_person_id?: string;
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
  // Set of LIVE person ids (already filtered by the query to
  // deleted_at IS NULL). Families don't have their husband_id/wife_id
  // cleared when a person is soft-deleted, so we defensively skip any
  // family-side reference that no longer resolves — otherwise
  // family-chart crashes with "Cannot read properties of undefined
  // (reading 'id')" when it tries to render the missing partner.
  const livePersonIds = new Set(persons.map((p) => p.id));

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
        if (fam.husband_id && livePersonIds.has(fam.husband_id))
          parents.push(fam.husband_id);
        if (fam.wife_id && livePersonIds.has(fam.wife_id))
          parents.push(fam.wife_id);
      }
    }

    const myFamilies = familiesOf.get(p.id) ?? [];
    const spouses = myFamilies
      .map((f) => (f.husband_id === p.id ? f.wife_id : f.husband_id))
      .filter((id): id is string => id !== null && livePersonIds.has(id));
    const children = myFamilies
      .flatMap((f) => childrenByFamily.get(f.id) ?? [])
      .filter((id) => livePersonIds.has(id));

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
 * Build the synthetic ghost-spouse F3Datum id for a ghost. Stable +
 * unique across reloads — keyed off (linkId, peerSpouseId) which the
 * RPC already returns.
 */
export function ghostSpouseId(linkId: string, peerSpouseId: string): string {
  return `ghost:${linkId}:${peerSpouseId}`;
}

/**
 * Mutate the F3Datum array in-place:
 *  - append one synthetic node per ghost candidate,
 *  - register the ghost id as a spouse of the local person.
 *
 * Skips a ghost when the local anchor already has a non-ghost local
 * spouse with the same full_name + birth_year — that's almost always
 * the same real-world person already represented on this tree
 * (e.g. the local rể) but without a confirmed inlaw link establishing
 * the formal mirror. Without this guard the ghost duplicates an
 * existing card and family-chart renders them side-by-side.
 *
 * Returns the same array so callers can chain. Idempotent — calling
 * twice with the same input no-ops the second time.
 */
export function addInlawGhosts(
  data: F3Datum[],
  ghosts: InlawGhostSpouse[],
): F3Datum[] {
  if (ghosts.length === 0) return data;

  const byId = new Map(data.map((d) => [d.id, d]));
  for (const g of ghosts) {
    const local = byId.get(g.localPersonId);
    if (!local) continue;

    const id = ghostSpouseId(g.linkId, g.spouseId);
    if (byId.has(id)) continue;

    // Heuristic dedup: same full_name (+ year when both present) on
    // an existing local spouse → skip. Covers the case where the
    // inlaw link for THIS person wasn't (or was un-)confirmed but the
    // local mirror still exists on the tree.
    const ghostName = (g.spouseFullName ?? "").trim();
    const ghostYear = g.spouseBirthYear ? String(g.spouseBirthYear) : null;
    if (ghostName) {
      const localSpouseDuplicates = local.rels.spouses
        .map((sid) => byId.get(sid))
        .filter((d): d is F3Datum => !!d && d.data.is_ghost !== true)
        .some((d) => {
          if ((d.data["full name"] ?? "").trim() !== ghostName) return false;
          // If both sides have a year, require exact match; if either
          // is missing, accept the name match alone (Vietnamese
          // full names are specific enough that collisions are rare).
          if (ghostYear && d.data.birthday) {
            return d.data.birthday === ghostYear;
          }
          return true;
        });
      if (localSpouseDuplicates) continue;
    }

    const displayName = g.masked
      ? "Người còn sống"
      : g.spouseFullName ?? "?";

    const ghost: F3Datum = {
      id,
      data: {
        gender: g.spouseGender,
        "full name": displayName,
        birthday: g.spouseBirthYear ? String(g.spouseBirthYear) : undefined,
        death_year: g.spouseDeathYear ? String(g.spouseDeathYear) : undefined,
        is_living: g.spouseIsLiving,
        is_root: false,
        generation: null,
        avatar: g.spouseGender === "M" ? "/avatars/male.png" : "/avatars/female.png",
        is_ghost: true,
        ghost_link_id: g.linkId,
        ghost_peer_clan_name: g.peerClanName,
        ghost_local_person_id: g.localPersonId,
      },
      // Ghost is a stub — no parents/children in this clan; only
      // attached to the local anchor as a spouse.
      rels: { parents: [], spouses: [g.localPersonId], children: [] },
    };
    data.push(ghost);
    byId.set(id, ghost);

    // Wire ghost as a spouse of the local person, dedupe to avoid
    // doubling on re-render.
    if (!local.rels.spouses.includes(id)) {
      local.rels.spouses.push(id);
    }
  }
  return data;
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
