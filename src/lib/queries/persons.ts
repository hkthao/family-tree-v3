import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { unaccent } from "@/lib/unaccent";

type Client = SupabaseClient<Database>;

export type DatePrecision = "day" | "month" | "year";

export interface PersonRow {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  birth_date: string | null;
  birth_date_precision: DatePrecision | null;
  death_date: string | null;
  death_date_precision: DatePrecision | null;
  generation: number | null;
  branch_id: string | null;
  photo_path: string | null;
}

export type PersonsSource = "persons" | "persons_public_safe";

export interface ListPersonsParams {
  page: number; // 1-based
  pageSize: number;
  search?: string;
  branchId?: string | null;
  generation?: number | null;
  sort?: "name" | "generation" | "birth";
  /**
   * Where to read from. Members + platform admins read the raw table for
   * full data; non-members of a `visibility=public` clan read the view
   * which masks sensitive columns for living persons (plan §4).
   */
  source?: PersonsSource;
}

export interface ListPersonsResult {
  rows: PersonRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Server-paginated list of persons in a clan.
 *
 * - Search uses ILIKE against full_name_unaccent (Postgres trigram index).
 * - Soft-deleted rows are filtered out.
 * - Caller's RLS guarantees they only see clans they're a member of.
 */
export async function listPersons(
  clanId: string,
  params: ListPersonsParams,
  client: Client = defaultClient,
): Promise<ListPersonsResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const source: PersonsSource = params.source ?? "persons";

  // The public-safe view already filters `deleted_at IS NULL` internally;
  // applying it again would be harmless but ineffective on the view (the
  // column is masked-out → not part of the projection).
  let q =
    source === "persons_public_safe"
      ? client
          .from("persons_public_safe")
          .select(
            "id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id, photo_path",
            { count: "exact" },
          )
          .eq("clan_id", clanId)
          .range(from, to)
      : client
          .from("persons")
          .select(
            "id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id, photo_path",
            { count: "exact" },
          )
          .eq("clan_id", clanId)
          .is("deleted_at", null)
          .range(from, to);

  if (params.search && params.search.trim()) {
    const needle = unaccent(params.search);
    // search_text is the concatenated unaccented blob of full_name,
    // courtesy/posthumous/nickname, bio, birth_place, burial_place
    // — typing "Hà Nội" finds anyone born/buried there; typing "Tí"
    // finds every nickname; etc. Trigram GIN index keeps it fast.
    // Falls back to the public-safe view's `full_name_unaccent`
    // when reading from there since that view doesn't expose
    // search_text (masked fields would leak).
    if (source === "persons_public_safe") {
      q = q.ilike("full_name_unaccent", `%${needle}%`);
    } else {
      q = q.ilike("search_text", `%${needle}%`);
    }
  }
  if (params.branchId !== undefined && params.branchId !== null) {
    q = q.eq("branch_id", params.branchId);
  }
  if (params.generation !== undefined && params.generation !== null) {
    q = q.eq("generation", params.generation);
  }

  switch (params.sort ?? "name") {
    case "name":
      q = q.order("full_name_unaccent", { ascending: true });
      break;
    case "generation":
      q = q
        .order("generation", { ascending: true, nullsFirst: false })
        .order("full_name_unaccent", { ascending: true });
      break;
    case "birth":
      q = q
        .order("birth_date", { ascending: true, nullsFirst: false })
        .order("full_name_unaccent", { ascending: true });
      break;
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as PersonRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export interface CreatePersonInput {
  clan_id: string;
  full_name: string;
  gender: "M" | "F";
  is_living?: boolean;
  is_root?: boolean;
  birth_date?: string | null;
  birth_date_precision?: DatePrecision | null;
  death_date?: string | null;
  death_date_precision?: DatePrecision | null;
  branch_id?: string | null;
  birth_family_id?: string | null;
  // Extra biographical fields — optional. Mirrors UpdatePersonInput so a
  // "copy" can preserve everything visible in EditPerson in one insert,
  // without a follow-up update.
  bio?: string | null;
  birth_place?: string | null;
  burial_place?: string | null;
  courtesy_name?: string | null;
  posthumous_name?: string | null;
  nickname?: string | null;
  // Lunar calendar columns — set when the user typed the date in
  // lunar mode (tombstones do this), or auto-derived from a full
  // solar day.
  birth_lunar_year?: number | null;
  birth_lunar_month?: number | null;
  birth_lunar_day?: number | null;
  birth_lunar_is_leap?: boolean;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_lunar_is_leap?: boolean;
  // Recurring giỗ — month/day in lunar, repeats each year.
  death_anniv_lunar_month?: number | null;
  death_anniv_lunar_day?: number | null;
  death_anniv_lunar_is_leap?: boolean;
}

export async function createPerson(
  input: CreatePersonInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("persons")
    .insert({
      clan_id: input.clan_id,
      full_name: input.full_name,
      gender: input.gender,
      is_living: input.is_living ?? true,
      is_root: input.is_root ?? false,
      birth_date: input.birth_date ?? null,
      birth_date_precision:
        input.birth_date_precision ?? (input.birth_date ? "day" : null),
      death_date: input.death_date ?? null,
      death_date_precision:
        input.death_date_precision ?? (input.death_date ? "day" : null),
      branch_id: input.branch_id ?? null,
      birth_family_id: input.birth_family_id ?? null,
      bio: input.bio ?? null,
      birth_place: input.birth_place ?? null,
      burial_place: input.burial_place ?? null,
      courtesy_name: input.courtesy_name ?? null,
      posthumous_name: input.posthumous_name ?? null,
      nickname: input.nickname ?? null,
      birth_lunar_year: input.birth_lunar_year ?? null,
      birth_lunar_month: input.birth_lunar_month ?? null,
      birth_lunar_day: input.birth_lunar_day ?? null,
      birth_lunar_is_leap: input.birth_lunar_is_leap ?? false,
      death_lunar_year: input.death_lunar_year ?? null,
      death_lunar_month: input.death_lunar_month ?? null,
      death_lunar_day: input.death_lunar_day ?? null,
      death_lunar_is_leap: input.death_lunar_is_leap ?? false,
      death_anniv_lunar_month: input.death_anniv_lunar_month ?? null,
      death_anniv_lunar_day: input.death_anniv_lunar_day ?? null,
      death_anniv_lunar_is_leap: input.death_anniv_lunar_is_leap ?? false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

export interface PersonDetail extends PersonRow {
  clan_id: string;
  courtesy_name: string | null;
  posthumous_name: string | null;
  nickname: string | null;
  bio: string | null;
  birth_place: string | null;
  burial_place: string | null;
  photo_path: string | null;
  birth_lunar_year: number | null;
  birth_lunar_month: number | null;
  birth_lunar_day: number | null;
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
  todo_excluded: boolean;
}

const DETAIL_COLS =
  "id, clan_id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id, courtesy_name, posthumous_name, nickname, bio, birth_place, burial_place, photo_path, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day, death_anniv_lunar_month, death_anniv_lunar_day, todo_excluded";

export async function getPerson(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonDetail | null> {
  const { data, error } = await client
    .from("persons")
    .select(DETAIL_COLS)
    .eq("id", personId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PersonDetail | null) ?? null;
}

export interface UpdatePersonInput {
  full_name?: string;
  gender?: "M" | "F";
  is_living?: boolean;
  is_root?: boolean;
  birth_date?: string | null;
  birth_date_precision?: DatePrecision | null;
  death_date?: string | null;
  death_date_precision?: DatePrecision | null;
  bio?: string | null;
  birth_place?: string | null;
  burial_place?: string | null;
  courtesy_name?: string | null;
  posthumous_name?: string | null;
  nickname?: string | null;
  photo_path?: string | null;
  /** Birth family — pointing here re-parents the person. Used by
   *  AddParent flow's "new" mode to attach a freshly-created parent
   *  family to the focal. */
  birth_family_id?: string | null;
  /** Skip this person in /todo (no gap surfaces, no badge count). */
  todo_excluded?: boolean;
  // Lunar columns — write through unchanged when undefined; explicit
  // null means "clear" (e.g., user switched a day-precision solar to
  // year-only so we drop the previously-derived lunar values).
  birth_lunar_year?: number | null;
  birth_lunar_month?: number | null;
  birth_lunar_day?: number | null;
  birth_lunar_is_leap?: boolean;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_lunar_is_leap?: boolean;
  death_anniv_lunar_month?: number | null;
  death_anniv_lunar_day?: number | null;
  death_anniv_lunar_is_leap?: boolean;
}

export async function updatePerson(
  personId: string,
  input: UpdatePersonInput,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("persons")
    .update(input)
    .eq("id", personId);

  if (error) throw new Error(error.message);
}

/**
 * "Delete" a person — the BEFORE DELETE trigger converts this to a
 * soft delete (set deleted_at = now()). The audit log records the
 * before-row so it can be restored via the audit UI later.
 */
export async function deletePerson(
  personId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("persons").delete().eq("id", personId);
  if (error) throw new Error(error.message);
}

/**
 * Bulk-update the `branch_id` for a set of persons in one round-trip.
 * Pass `branchId = null` to clear the chi assignment. Each row still
 * fires the audit trigger (one before/after pair per person), so the
 * change is restorable per-person from the audit log.
 */
export async function updatePersonsBranchBulk(
  ids: string[],
  branchId: string | null,
  client: Client = defaultClient,
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const { error, count } = await client
    .from("persons")
    .update({ branch_id: branchId }, { count: "exact" })
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { updated: count ?? 0 };
}

export interface QrExportRow {
  id: string;
  full_name: string;
  courtesy_name: string | null;
  gender: "M" | "F";
  is_living: boolean;
  generation: number | null;
  branch_id: string | null;
  birth_date: string | null;
  death_date: string | null;
}

export interface ListPersonsForQrExportParams {
  branchId?: string | null;
  generationMin?: number | null;
  generationMax?: number | null;
  deceasedOnly?: boolean;
  limit?: number;
}

/**
 * Slim, unpaginated person list shaped for the QR bulk-export page.
 * Hard-capped at `limit` (default 500) so we don't accidentally pull a
 * 5000-person clan into the browser.
 */
export async function listPersonsForQrExport(
  clanId: string,
  params: ListPersonsForQrExportParams = {},
  client: Client = defaultClient,
): Promise<QrExportRow[]> {
  let q = client
    .from("persons")
    .select(
      "id, full_name, courtesy_name, gender, is_living, generation, branch_id, birth_date, death_date",
    )
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("generation", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true })
    .limit(params.limit ?? 500);
  if (params.branchId) q = q.eq("branch_id", params.branchId);
  if (params.generationMin !== undefined && params.generationMin !== null) {
    q = q.gte("generation", params.generationMin);
  }
  if (params.generationMax !== undefined && params.generationMax !== null) {
    q = q.lte("generation", params.generationMax);
  }
  if (params.deceasedOnly) q = q.eq("is_living", false);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as QrExportRow[];
}

/**
 * Bulk-soft-delete persons. The BEFORE DELETE trigger converts each
 * DELETE into a soft-delete (set deleted_at = now()). Single
 * round-trip; per-row audit entries are emitted.
 */
export async function deletePersonsBulk(
  ids: string[],
  client: Client = defaultClient,
): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const { error, count } = await client
    .from("persons")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { deleted: count ?? 0 };
}
