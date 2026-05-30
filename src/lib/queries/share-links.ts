import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface ShareLink {
  id: string;
  clan_id: string;
  token: string;
  root_person_id: string | null;
  scope: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

export async function listShareLinks(
  clanId: string,
  client: Client = defaultClient,
): Promise<ShareLink[]> {
  const { data, error } = await client
    .from("share_links")
    .select("id, clan_id, token, root_person_id, scope, expires_at, is_revoked, created_at")
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ShareLink[];
}

export interface CreateShareLinkInput {
  clan_id: string;
  /** Days from now until link expires. */
  ttlDays: number;
  root_person_id?: string | null;
}

/**
 * Make a token using the Web Crypto API (32 url-safe characters).
 * Browser-side generation is fine because the FK + RLS already enforce
 * that only the clan admin can persist this row. Anonymous viewers later
 * present the token to the Edge Function which alone has DB access.
 */
function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url without padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createShareLink(
  input: CreateShareLinkInput,
  client: Client = defaultClient,
): Promise<ShareLink> {
  const expires = new Date(Date.now() + input.ttlDays * 86400_000).toISOString();
  const { data, error } = await client
    .from("share_links")
    .insert({
      clan_id: input.clan_id,
      token: makeToken(),
      root_person_id: input.root_person_id ?? null,
      scope: "tree_view",
      expires_at: expires,
    })
    .select("id, clan_id, token, root_person_id, scope, expires_at, is_revoked, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ShareLink;
}

export async function revokeShareLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("share_links")
    .update({ is_revoked: true })
    .eq("id", linkId);
  if (error) throw new Error(error.message);
}

export async function deleteShareLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("share_links").delete().eq("id", linkId);
  if (error) throw new Error(error.message);
}
