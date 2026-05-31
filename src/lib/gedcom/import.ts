import { supabase } from "@/lib/supabase";

import type { ParsedGedcom, ParsedIndi } from "./parse";

export interface GedcomImportResult {
  personsCreated: number;
  familiesCreated: number;
  branchesCreated: number;
  warnings: string[];
}

/**
 * Applies a parsed GEDCOM file to the given clan as NEW data.
 * No merge / dedupe — every individual is created fresh. Operators
 * intending to merge with an existing clan should import into an empty
 * clan first and then move people via the UI.
 *
 * Implemented as plain INSERTs (vs bulk_import_persons) because:
 *   - We need to round-trip GEDCOM pointers (@I1@, @F1@) to our UUIDs,
 *     which the RPC doesn't expose.
 *   - We want to preserve is_root flags and the import's family graph,
 *     not let the generation trigger infer one.
 */
export async function importGedcomIntoClan(
  clanId: string,
  parsed: ParsedGedcom,
): Promise<GedcomImportResult> {
  const warnings: string[] = [];

  // 1) Create branches first (so we can FK persons.branch_id)
  const branchNames = new Set(
    parsed.indis
      .map((i) => i.branchName?.trim())
      .filter((n): n is string => !!n),
  );
  const branchByName = new Map<string, string>();
  for (const name of branchNames) {
    const { data, error } = await supabase
      .from("branches")
      .insert({ clan_id: clanId, name })
      .select("id")
      .single();
    if (error) {
      warnings.push(`branch "${name}": ${error.message}`);
      continue;
    }
    branchByName.set(name, data.id);
  }

  // 2) Create persons. Map GEDCOM pointer → new UUID.
  const ptrToId = new Map<string, string>();

  for (const indi of parsed.indis) {
    const row = indiToInsert(indi, clanId, branchByName);
    const { data, error } = await supabase
      .from("persons")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      warnings.push(`person ${indi.fullName}: ${error.message}`);
      continue;
    }
    ptrToId.set(indi.ptr, data.id);
  }

  // 3) Create families now that persons exist. Then UPDATE each
  //    child's birth_family_id pointer.
  const famPtrToId = new Map<string, string>();
  for (const fam of parsed.fams) {
    const husbandId = fam.husbandPtr ? ptrToId.get(fam.husbandPtr) : null;
    const wifeId = fam.wifePtr ? ptrToId.get(fam.wifePtr) : null;
    const { data, error } = await supabase
      .from("families")
      .insert({
        clan_id: clanId,
        husband_id: husbandId ?? null,
        wife_id: wifeId ?? null,
      })
      .select("id")
      .single();
    if (error) {
      warnings.push(`family ${fam.ptr}: ${error.message}`);
      continue;
    }
    famPtrToId.set(fam.ptr, data.id);

    // Set birth_family_id on each child
    for (const childPtr of fam.childPtrs) {
      const childId = ptrToId.get(childPtr);
      if (!childId) continue;
      const { error: upErr } = await supabase
        .from("persons")
        .update({ birth_family_id: data.id })
        .eq("id", childId);
      if (upErr) {
        warnings.push(`child ${childPtr}: ${upErr.message}`);
      }
    }
  }

  return {
    personsCreated: ptrToId.size,
    familiesCreated: famPtrToId.size,
    branchesCreated: branchByName.size,
    warnings,
  };
}

function indiToInsert(
  indi: ParsedIndi,
  clanId: string,
  branchByName: Map<string, string>,
) {
  return {
    clan_id: clanId,
    full_name: indi.fullName || "—",
    gender: indi.gender,
    is_living: indi.isLiving,
    is_root: indi.isRoot,
    birth_date: indi.birthDate,
    birth_date_precision: indi.birthDatePrecision,
    death_date: indi.deathDate,
    death_date_precision: indi.deathDatePrecision,
    birth_place: indi.birthPlace,
    burial_place: indi.burialPlace,
    courtesy_name: indi.courtesyName,
    nickname: indi.nickname,
    posthumous_name: indi.posthumousName,
    bio: indi.bio,
    birth_lunar_year: indi.birthLunarYear,
    birth_lunar_month: indi.birthLunarMonth,
    birth_lunar_day: indi.birthLunarDay,
    death_lunar_year: indi.deathLunarYear,
    death_lunar_month: indi.deathLunarMonth,
    death_lunar_day: indi.deathLunarDay,
    death_anniv_lunar_month: indi.gioMonth,
    death_anniv_lunar_day: indi.gioDay,
    branch_id: indi.branchName
      ? (branchByName.get(indi.branchName.trim()) ?? null)
      : null,
  };
}
