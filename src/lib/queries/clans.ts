import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { unaccent } from "@/lib/unaccent";

type Client = SupabaseClient<Database>;

export interface ClanSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  max_persons: number;
  max_users: number;
  owner_id: string | null;
  person_count: number;
  /** null on community-list rows where the caller is not a member. */
  role: "admin" | "editor" | "viewer" | null;
}

export type ClanSizeBucket = "tiny" | "small" | "medium" | "large";

/**
 * Inclusive size ranges for the community filter. Single source of truth
 * so the UI label and the query predicate can't drift.
 */
export const CLAN_SIZE_BUCKETS: Record<
  ClanSizeBucket,
  { label: string; min: number; max: number | null }
> = {
  tiny: { label: "Mới khởi tạo (<5)", min: 0, max: 4 },
  small: { label: "Nhỏ (5–19)", min: 5, max: 19 },
  medium: { label: "Vừa (20–49)", min: 20, max: 49 },
  large: { label: "Lớn (≥50)", min: 50, max: null },
};

export interface ListClansParams {
  page: number; // 1-based
  pageSize: number;
  search?: string;
  sizeBucket?: ClanSizeBucket | null;
}

export interface ListClansResult {
  rows: ClanSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const COLS =
  "id, name, description, visibility, max_persons, max_users, owner_id, person_count";

async function isPlatformAdmin(userId: string, client: Client): Promise<boolean> {
  const { data } = await client
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.is_platform_admin;
}

/**
 * "Của tôi" — clans where the caller has an explicit clan_members row.
 *
 * Platform admin behaves the same: their "Của tôi" is whatever they
 * actually own/joined, NOT every clan in the system. They use the
 * "Cộng đồng" tab to browse the rest.
 */
export async function listMyClans(
  userId: string,
  params: ListClansParams,
  client: Client = defaultClient,
): Promise<ListClansResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let q = client
    .from("clan_members")
    .select(
      `role, clan:clans!inner ( ${COLS}, name_unaccent )`,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (params.search?.trim()) {
    const needle = `%${unaccent(params.search)}%`;
    q = q.ilike("clan.name_unaccent", needle);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? [])
    .filter((row) => row.clan !== null)
    .map((row) => ({
      ...(row.clan as Omit<ClanSummary, "role">),
      role: row.role as ClanSummary["role"],
    }));
  return { rows, total: count ?? 0, page: params.page, pageSize: params.pageSize };
}

/**
 * "Cộng đồng" — public clans the caller can SEE but isn't a member of.
 * Plus every clan when the caller is a platform admin (they can see
 * private clans too).
 */
export async function listCommunityClans(
  userId: string,
  params: ListClansParams,
  client: Client = defaultClient,
): Promise<ListClansResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const pa = await isPlatformAdmin(userId, client);

  // Get the ids the caller is already a member of so we can subtract them.
  const { data: mem } = await client
    .from("clan_members")
    .select("clan_id")
    .eq("user_id", userId);
  const memberIds = (mem ?? []).map((r) => r.clan_id);

  let q = client
    .from("clans")
    .select(COLS, { count: "exact" })
    .order("created_at", { ascending: true })
    .range(from, to);

  // Platform admin sees every non-member clan (public + private).
  // Everyone else sees only public non-member clans.
  if (!pa) q = q.eq("visibility", "public");

  if (memberIds.length > 0) {
    q = q.not("id", "in", `(${memberIds.join(",")})`);
  }

  if (params.search?.trim()) {
    const needle = `%${unaccent(params.search)}%`;
    q = q.ilike("name_unaccent", needle);
  }

  if (params.sizeBucket) {
    const b = CLAN_SIZE_BUCKETS[params.sizeBucket];
    q = q.gte("person_count", b.min);
    if (b.max !== null) q = q.lte("person_count", b.max);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((c) => ({
      ...(c as Omit<ClanSummary, "role">),
      role: null,
    })),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export interface CreateClanInput {
  name: string;
  description?: string;
  visibility?: "private" | "public";
}

export async function createClan(
  input: CreateClanInput,
  ownerId: string,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("clans")
    .insert({
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility ?? "private",
      owner_id: ownerId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}
