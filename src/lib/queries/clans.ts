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
  /** Offset hiển thị đời (0 mặc định; 1 = Thủy tổ là Đời 0). */
  generation_offset: number;
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

export type ClanSort = "members" | "name" | "newest";

export const CLAN_SORT_LABEL: Record<ClanSort, string> = {
  members: "Số thành viên (nhiều → ít)",
  name: "Tên (A → Z)",
  newest: "Mới tạo",
};

export interface ListClansParams {
  page: number; // 1-based
  pageSize: number;
  search?: string;
  sizeBucket?: ClanSizeBucket | null;
  /** Tiêu chí sắp xếp; mặc định theo số thành viên (nhiều → ít). */
  sort?: ClanSort;
}

/** Cột + chiều sắp xếp theo tiêu chí. */
function sortColumn(sort: ClanSort | undefined): {
  col: string;
  ascending: boolean;
} {
  switch (sort) {
    case "name":
      return { col: "name_unaccent", ascending: true };
    case "newest":
      return { col: "created_at", ascending: false };
    case "members":
    default:
      return { col: "person_count", ascending: false };
  }
}

export interface ListClansResult {
  rows: ClanSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const COLS =
  "id, name, description, visibility, max_persons, max_users, owner_id, person_count, generation_offset";

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

  // Lấy clan_id + vai trò của caller. Query clans TRỰC TIẾP (thay vì embed
  // qua clan_members) để sắp xếp được theo cột của clans (person_count…) +
  // phân trang phía server.
  const { data: mem, error: memErr } = await client
    .from("clan_members")
    .select("clan_id, role")
    .eq("user_id", userId);
  if (memErr) throw new Error(memErr.message);
  const ids = (mem ?? []).map((m) => m.clan_id);
  const roleById = new Map(
    (mem ?? []).map((m) => [m.clan_id, m.role as ClanSummary["role"]]),
  );
  if (ids.length === 0) {
    return { rows: [], total: 0, page: params.page, pageSize: params.pageSize };
  }

  const sort = sortColumn(params.sort);
  let q = client
    .from("clans")
    .select(COLS, { count: "exact" })
    .in("id", ids)
    .order(sort.col, { ascending: sort.ascending })
    .order("name_unaccent", { ascending: true })
    .range(from, to);

  if (params.search?.trim()) {
    q = q.ilike("name_unaccent", `%${unaccent(params.search)}%`);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((c) => ({
    ...(c as Omit<ClanSummary, "role">),
    role: roleById.get((c as { id: string }).id) ?? null,
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

  const sort = sortColumn(params.sort);
  let q = client
    .from("clans")
    .select(COLS, { count: "exact" })
    .order(sort.col, { ascending: sort.ascending })
    .order("name_unaccent", { ascending: true })
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
