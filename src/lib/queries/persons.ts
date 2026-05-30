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
            "id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id",
            { count: "exact" },
          )
          .eq("clan_id", clanId)
          .range(from, to)
      : client
          .from("persons")
          .select(
            "id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id",
            { count: "exact" },
          )
          .eq("clan_id", clanId)
          .is("deleted_at", null)
          .range(from, to);

  if (params.search && params.search.trim()) {
    const needle = unaccent(params.search);
    q = q.ilike("full_name_unaccent", `%${needle}%`);
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
}

const DETAIL_COLS =
  "id, clan_id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, death_date_precision, generation, branch_id, courtesy_name, posthumous_name, nickname, bio, birth_place, burial_place, photo_path, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day, death_anniv_lunar_month, death_anniv_lunar_day";

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
