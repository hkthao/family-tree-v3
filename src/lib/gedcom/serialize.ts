/**
 * GEDCOM 5.5.1 serializer for a clan's data.
 *
 * Produces a UTF-8 .ged string suitable for round-tripping with any
 * GEDCOM-compatible tool (FamilySearch, MyHeritage, Family Tree Maker
 * etc.). Vietnamese-specific fields the spec doesn't cover are emitted
 * as custom tags (prefix _) so a re-import via our own parser can
 * restore them losslessly.
 */

import type { ClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";

const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

interface Out {
  lines: string[];
}

function emit(o: Out, level: number, tag: string, value?: string | number) {
  o.lines.push(
    value === undefined || value === null || value === ""
      ? `${level} ${tag}`
      : `${level} ${tag} ${value}`,
  );
}

/** "Nguyễn Văn A" → "/Nguyễn/ Văn A" — surname goes in slashes per GEDCOM. */
function nameToGed(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/);
  if (tokens.length === 0) return "";
  const surname = tokens[0];
  const given = tokens.slice(1).join(" ");
  return given ? `/${surname}/ ${given}` : `/${surname}/`;
}

/** ISO 2024-06-15 → "15 JUN 2024" (or "JUN 2024" / "2024" for partials). */
function isoToGed(
  iso: string | null | undefined,
  precision: "day" | "month" | "year" | null | undefined,
): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isInteger(y)) return null;
  if (precision === "year" || !precision) return String(y);
  if (precision === "month" || !Number.isInteger(d)) {
    if (!Number.isInteger(m)) return String(y);
    return `${MONTH_ABBR[m - 1]} ${y}`;
  }
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

/**
 * Serialize a whole clan to a GEDCOM string.
 *
 * @param clan   clan detail row (name, description, etc.)
 * @param data   full clan book data (persons, families, branches, childToFamily)
 */
export function serializeClanToGedcom(
  clan: ClanDetail,
  data: ClanBookData,
): string {
  const o: Out = { lines: [] };

  // ─── Header ──────────────────────────────────────────────────
  emit(o, 0, "HEAD");
  emit(o, 1, "SOUR", "Gia-pha");
  emit(o, 2, "VERS", "1.0");
  emit(o, 2, "NAME", "Gia phả");
  emit(o, 1, "GEDC");
  emit(o, 2, "VERS", "5.5.1");
  emit(o, 2, "FORM", "LINEAGE-LINKED");
  emit(o, 1, "CHAR", "UTF-8");
  emit(o, 1, "DATE", isoToGed(today(), "day") ?? today());
  emit(o, 1, "_CLAN");
  emit(o, 2, "NAME", clan.name);
  if (clan.description) emit(o, 2, "NOTE", clan.description);

  // Branch lookup for the custom tag
  const branchById = new Map(data.branches.map((b) => [b.id, b.name]));

  // Reverse map: parent person id → array of {family_id, child_id} from
  // data.childToFamily. We need it to emit FAMC pointers per person.
  const personIdx = new Map<string, number>();
  data.persons.forEach((p, i) => personIdx.set(p.id, i + 1));
  const personPtr = (id: string): string => `@I${personIdx.get(id) ?? "?"}@`;

  const famIdx = new Map<string, number>();
  data.families.forEach((f, i) => famIdx.set(f.id, i + 1));
  const famPtr = (id: string): string => `@F${famIdx.get(id) ?? "?"}@`;

  // Build "families this person is a spouse in"
  const famsOf = new Map<string, string[]>();
  for (const f of data.families) {
    if (f.husband_id) pushTo(famsOf, f.husband_id, f.id);
    if (f.wife_id) pushTo(famsOf, f.wife_id, f.id);
  }

  // ─── INDI records ────────────────────────────────────────────
  for (const p of data.persons) {
    emit(o, 0, `${personPtr(p.id)}`, "INDI");
    emit(o, 1, "NAME", nameToGed(p.full_name));
    emit(o, 1, "SEX", p.gender);

    const birthGed = isoToGed(p.birth_date, p.birth_date_precision);
    if (birthGed || p.birth_place) {
      emit(o, 1, "BIRT");
      if (birthGed) emit(o, 2, "DATE", birthGed);
      if (p.birth_place) emit(o, 2, "PLAC", p.birth_place);
    }

    const deathGed = isoToGed(p.death_date, p.death_date_precision);
    if (!p.is_living || deathGed || p.burial_place) {
      emit(o, 1, "DEAT");
      if (deathGed) emit(o, 2, "DATE", deathGed);
      if (p.burial_place) emit(o, 2, "PLAC", p.burial_place);
    }

    // Vietnamese-specific custom tags
    if (p.courtesy_name) emit(o, 1, "_COURTESY", p.courtesy_name);
    if (p.nickname) emit(o, 1, "_NICKNAME", p.nickname);
    if (p.posthumous_name) emit(o, 1, "_POSTHUMOUS", p.posthumous_name);
    if (p.branch_id && branchById.get(p.branch_id)) {
      emit(o, 1, "_BRANCH", branchById.get(p.branch_id));
    }
    if (p.is_root) emit(o, 1, "_ROOT", "Y");
    if (p.generation !== null) emit(o, 1, "_GEN", p.generation);

    // Lunar birth / death
    if (p.birth_lunar_year && p.birth_lunar_month && p.birth_lunar_day) {
      emit(o, 1, "_LUNAR_BIRTH");
      emit(o, 2, "YEAR", p.birth_lunar_year);
      emit(o, 2, "MONTH", p.birth_lunar_month);
      emit(o, 2, "DAY", p.birth_lunar_day);
    }
    if (p.death_lunar_year && p.death_lunar_month && p.death_lunar_day) {
      emit(o, 1, "_LUNAR_DEATH");
      emit(o, 2, "YEAR", p.death_lunar_year);
      emit(o, 2, "MONTH", p.death_lunar_month);
      emit(o, 2, "DAY", p.death_lunar_day);
    }
    if (p.death_anniv_lunar_month && p.death_anniv_lunar_day) {
      emit(o, 1, "_GIO");
      emit(o, 2, "MONTH", p.death_anniv_lunar_month);
      emit(o, 2, "DAY", p.death_anniv_lunar_day);
    }

    if (p.bio) emit(o, 1, "NOTE", p.bio);

    // Family pointers: FAMC = the family they were a child in,
    // FAMS = each family they're a spouse in.
    const famc = data.childToFamily[p.id];
    if (famc && famIdx.has(famc)) emit(o, 1, "FAMC", famPtr(famc));
    for (const famId of famsOf.get(p.id) ?? []) {
      emit(o, 1, "FAMS", famPtr(famId));
    }
  }

  // ─── FAM records ─────────────────────────────────────────────
  for (const f of data.families) {
    emit(o, 0, famPtr(f.id), "FAM");
    if (f.husband_id && personIdx.has(f.husband_id)) {
      emit(o, 1, "HUSB", personPtr(f.husband_id));
    }
    if (f.wife_id && personIdx.has(f.wife_id)) {
      emit(o, 1, "WIFE", personPtr(f.wife_id));
    }
    // Children: every person whose birth_family_id === this family
    for (const [childId, famId] of Object.entries(data.childToFamily)) {
      if (famId === f.id && personIdx.has(childId)) {
        emit(o, 1, "CHIL", personPtr(childId));
      }
    }
  }

  // ─── Trailer ─────────────────────────────────────────────────
  emit(o, 0, "TRLR");

  return o.lines.join("\n") + "\n";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function pushTo<K, V>(m: Map<K, V[]>, key: K, value: V) {
  const arr = m.get(key);
  if (arr) arr.push(value);
  else m.set(key, [value]);
}
