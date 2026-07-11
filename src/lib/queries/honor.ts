import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type HonorCategory =
  | "donation_money"
  | "donation_labor"
  | "academic"
  | "other";

export interface HonorEntry {
  id: string;
  clan_id: string;
  person_id: string | null;
  honoree_name: string;
  category: HonorCategory;
  amount: number | null;
  note: string | null;
  occurred_on: string | null;
  created_at: string;
}

export const HONOR_CATEGORY_LABEL: Record<HonorCategory, string> = {
  donation_money: "Công đức (tiền)",
  donation_labor: "Đóng góp công sức",
  academic: "Thành tích học tập",
  other: "Khác",
};

const COLS =
  "id, clan_id, person_id, honoree_name, category, amount, note, occurred_on, created_at";

export async function listHonorEntries(
  clanId: string,
  client: Client = defaultClient,
): Promise<HonorEntry[]> {
  const { data, error } = await client
    .from("honor_entries")
    .select(COLS)
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...(r as HonorEntry),
    amount: r.amount == null ? null : Number(r.amount),
  }));
}

export type HonorInput = {
  honoree_name: string;
  category: HonorCategory;
  amount?: number | null;
  note?: string | null;
  occurred_on?: string | null;
  person_id?: string | null;
};

export async function createHonorEntry(
  clanId: string,
  input: HonorInput,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("honor_entries").insert({
    clan_id: clanId,
    honoree_name: input.honoree_name,
    category: input.category,
    amount: input.amount ?? null,
    note: input.note ?? null,
    occurred_on: input.occurred_on ?? null,
    person_id: input.person_id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateHonorEntry(
  id: string,
  patch: Partial<HonorInput>,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("honor_entries")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Xoá mềm (deleted_at). */
export async function deleteHonorEntry(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("honor_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
