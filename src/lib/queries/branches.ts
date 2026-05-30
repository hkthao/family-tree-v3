import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface BranchRow {
  id: string;
  clan_id: string;
  name: string;
  head_person_id: string | null;
  ancestral_house: string | null;
  notes: string | null;
}

/** List branches for a clan (non-deleted), ordered by name. */
export async function listBranches(
  clanId: string,
  client: Client = defaultClient,
): Promise<BranchRow[]> {
  const { data, error } = await client
    .from("branches")
    .select("id, clan_id, name, head_person_id, ancestral_house, notes")
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchRow[];
}

export interface CreateBranchInput {
  clan_id: string;
  name: string;
  head_person_id?: string | null;
  ancestral_house?: string | null;
  notes?: string | null;
}

export async function createBranch(
  input: CreateBranchInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("branches")
    .insert({
      clan_id: input.clan_id,
      name: input.name.trim(),
      head_person_id: input.head_person_id ?? null,
      ancestral_house: input.ancestral_house ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export interface UpdateBranchInput {
  name?: string;
  head_person_id?: string | null;
  ancestral_house?: string | null;
  notes?: string | null;
}

export async function updateBranch(
  branchId: string,
  input: UpdateBranchInput,
  client: Client = defaultClient,
): Promise<void> {
  const payload: Database["public"]["Tables"]["branches"]["Update"] = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.head_person_id !== undefined) payload.head_person_id = input.head_person_id;
  if (input.ancestral_house !== undefined) payload.ancestral_house = input.ancestral_house;
  if (input.notes !== undefined) payload.notes = input.notes;

  const { error } = await client
    .from("branches")
    .update(payload)
    .eq("id", branchId);
  if (error) throw new Error(error.message);
}

/**
 * Delete a branch. Soft delete via the branches BEFORE DELETE trigger;
 * persons.branch_id rows in the clan are left pointing at the deleted
 * branch (RLS still filters them out so they read as "no branch").
 */
export async function deleteBranch(
  branchId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("branches").delete().eq("id", branchId);
  if (error) throw new Error(error.message);
}
