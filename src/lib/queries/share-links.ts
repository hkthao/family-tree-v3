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

export interface ShareLinksPage {
  rows: ShareLink[];
  total: number;
}

export async function listShareLinksPage(
  clanId: string,
  params: { page: number; pageSize: number },
  client: Client = defaultClient,
): Promise<ShareLinksPage> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const { data, error, count } = await client
    .from("share_links")
    .select(
      "id, clan_id, token, root_person_id, scope, expires_at, is_revoked, created_at",
      { count: "exact" },
    )
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ShareLink[], total: count ?? 0 };
}

export interface CreateShareLinkInput {
  clan_id: string;
  /** Days from now until link expires. */
  ttlDays: number;
  root_person_id?: string | null;
  scope?: string;
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
      scope: input.scope ?? "tree_view",
      expires_at: expires,
    })
    .select("id, clan_id, token, root_person_id, scope, expires_at, is_revoked, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ShareLink;
}

const PERSON_SCOPE = "single_person";
const PERSON_SHARE_TTL_DAYS = 365;

/**
 * Return an active (non-revoked, non-expired) personal share link for
 * the person, or create one if none exists. Used by "QR cá nhân" — we
 * reuse the existing token across reprints so the same physical QR
 * (engraved on a headstone, printed in a book) keeps resolving.
 */
export async function getOrCreatePersonShareLink(
  clanId: string,
  personId: string,
  client: Client = defaultClient,
): Promise<ShareLink> {
  const nowIso = new Date().toISOString();
  const { data: existing, error: selErr } = await client
    .from("share_links")
    .select("id, clan_id, token, root_person_id, scope, expires_at, is_revoked, created_at")
    .eq("clan_id", clanId)
    .eq("root_person_id", personId)
    .eq("scope", PERSON_SCOPE)
    .eq("is_revoked", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) throw new Error(selErr.message);
  if (existing && existing.length > 0) return existing[0] as ShareLink;

  return createShareLink(
    {
      clan_id: clanId,
      ttlDays: PERSON_SHARE_TTL_DAYS,
      root_person_id: personId,
      scope: PERSON_SCOPE,
    },
    client,
  );
}

const TREE_SCOPE = "tree_view";
const TREE_SHARE_TTL_DAYS = 90;

/**
 * Return an active (non-revoked, non-expired) clan-wide tree share
 * link — root_person_id IS NULL means "share the whole tree, viewer
 * picks the focal". Used by the "Chia sẻ cây" button on /tree so
 * repeated taps reuse the same URL instead of creating duplicates.
 *
 * Different from getOrCreatePersonShareLink which is scoped to a
 * single person (used for QR engraved on tombstones).
 */
export async function getOrCreateTreeShareLink(
  clanId: string,
  client: Client = defaultClient,
): Promise<ShareLink> {
  const nowIso = new Date().toISOString();
  const { data: existing, error: selErr } = await client
    .from("share_links")
    .select(
      "id, clan_id, token, root_person_id, scope, expires_at, is_revoked, created_at",
    )
    .eq("clan_id", clanId)
    .is("root_person_id", null)
    .eq("scope", TREE_SCOPE)
    .eq("is_revoked", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) throw new Error(selErr.message);
  if (existing && existing.length > 0) return existing[0] as ShareLink;

  return createShareLink(
    { clan_id: clanId, ttlDays: TREE_SHARE_TTL_DAYS, scope: TREE_SCOPE },
    client,
  );
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
