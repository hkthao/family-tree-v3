import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { unaccent } from "@/lib/unaccent";

type Client = SupabaseClient<Database>;

export interface PersonRow {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  birth_date: string | null;
  death_date: string | null;
  generation: number | null;
  branch_id: string | null;
}

export interface ListPersonsParams {
  page: number; // 1-based
  pageSize: number;
  search?: string;
  branchId?: string | null;
  generation?: number | null;
  sort?: "name" | "generation" | "birth";
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

  let q = client
    .from("persons")
    .select(
      "id, full_name, gender, is_living, is_root, birth_date, death_date, generation, branch_id",
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
  death_date?: string | null;
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
      death_date: input.death_date ?? null,
      branch_id: input.branch_id ?? null,
      birth_family_id: input.birth_family_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}
