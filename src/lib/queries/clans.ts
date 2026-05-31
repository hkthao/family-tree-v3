import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface ClanSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  max_persons: number;
  max_users: number;
  owner_id: string | null;
  role: "admin" | "editor" | "viewer";
}

/**
 * List clans for the "Dòng họ của tôi" page.
 *
 * - Regular users: only clans they're a member of, joined with their role.
 * - Platform admin: every clan, since they have full access by policy.
 *   They get role 'admin' so the existing UI logic (which keys off `role`)
 *   keeps working without a special case.
 */
export async function listMyClans(
  userId: string,
  client: Client = defaultClient,
): Promise<ClanSummary[]> {
  // First find out whether this caller is a platform admin so we don't
  // round-trip on every regular user. RLS lets them SELECT their own row.
  const { data: profile } = await client
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_platform_admin) {
    const { data, error } = await client
      .from("clans")
      .select(
        "id, name, description, visibility, max_persons, max_users, owner_id",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      ...(c as Omit<ClanSummary, "role">),
      role: "admin" as const,
    }));
  }

  const { data, error } = await client
    .from("clan_members")
    .select(
      `
      role,
      clan:clans (
        id, name, description, visibility, max_persons, max_users, owner_id
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.clan !== null)
    .map((row) => ({
      ...(row.clan as Omit<ClanSummary, "role">),
      role: row.role as ClanSummary["role"],
    }));
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
