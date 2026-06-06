/**
 * Cross-clan in-law links (Section 28 of plan.md).
 *
 * Each function wraps one RPC or one PostgREST round-trip. The
 * structural pattern matches share-links.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabase as defaultClient } from "@/lib/supabase";

type Client = SupabaseClient<Database>;

export type PersonLinkStatus = "pending" | "confirmed" | "revoked";

export interface PersonLink {
  id: string;
  status: PersonLinkStatus;
  clan_a_id: string;
  person_a_id: string;
  clan_b_id: string | null;
  person_b_id: string | null;
  invite_token: string | null;
  person_b_name_hint: string | null;
  note: string | null;
  created_by: string;
  confirmed_by: string | null;
  created_at: string;
  confirmed_at: string | null;
  revoked_at: string | null;
}

/**
 * Generate a short, URL-safe random token client-side. The DB has a
 * UNIQUE constraint on invite_token — collisions would error out, but
 * with 16 random bytes that's astronomically unlikely.
 */
function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** List every link involving the given clan (either side). */
export async function listLinksForClan(
  clanId: string,
  client: Client = defaultClient,
): Promise<PersonLink[]> {
  const { data, error } = await client
    .from("person_links")
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .or(`clan_a_id.eq.${clanId},clan_b_id.eq.${clanId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonLink[];
}

/** Active (confirmed) links involving the given person. */
export async function listLinksForPerson(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonLink[]> {
  const { data, error } = await client
    .from("person_links")
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .eq("status", "confirmed")
    .or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`);
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonLink[];
}

export interface ProposeLinkInput {
  clanAId: string;
  personAId: string;
  personBNameHint?: string;
  note?: string;
  createdBy: string;
}

/**
 * Insert a pending link in token mode. The B side stays null; admin B
 * fills it via `confirmByToken`.
 */
export async function proposeLink(
  input: ProposeLinkInput,
  client: Client = defaultClient,
): Promise<PersonLink> {
  const token = makeToken();
  const { data, error } = await client
    .from("person_links")
    .insert({
      clan_a_id: input.clanAId,
      person_a_id: input.personAId,
      invite_token: token,
      person_b_name_hint: input.personBNameHint?.trim() || null,
      note: input.note?.trim() || null,
      created_by: input.createdBy,
    })
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return data as PersonLink;
}

export async function revokeLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("person_links")
    .update({ status: "revoked" })
    .eq("id", linkId);
  if (error) throw new Error(error.message);
}

/**
 * Fire-and-forget call to the notify-inlaw Edge function. The function
 * inspects the row's CURRENT status and emails the appropriate side
 * — caller doesn't have to tell us which event fired. Errors are
 * swallowed so a Resend outage / network blip never breaks the user's
 * action.
 */
export function notifyInlaw(linkId: string): void {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return;
  fetch(`${base}/functions/v1/notify-inlaw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ link_id: linkId }),
  }).catch(() => {
    /* see jsdoc */
  });
}

export async function deletePendingLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("person_links").delete().eq("id", linkId);
  if (error) throw new Error(error.message);
}

// ─── RPC wrappers ────────────────────────────────────────────────────

export interface LinkTokenPreview {
  link_id: string;
  clan_a_name: string;
  person_a_name: string;
  person_a_gender: "M" | "F";
  person_a_birth_year: number | null;
  person_a_death_year: number | null;
  person_b_name_hint: string | null;
  note: string | null;
  created_at: string;
}

export async function resolveTokenPreview(
  token: string,
  client: Client = defaultClient,
): Promise<LinkTokenPreview> {
  const { data, error } = await client.rpc("resolve_link_token", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data as unknown as LinkTokenPreview;
}

export async function confirmByToken(
  args: { token: string; clanBId: string; personBId: string },
  client: Client = defaultClient,
): Promise<string> {
  const { data, error } = await client.rpc("confirm_link_by_token", {
    p_token: args.token,
    p_clan_b: args.clanBId,
    p_person_b: args.personBId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface LinkPeek {
  masked: boolean;
  clan_id: string;
  clan_name: string;
  person_id: string;
  full_name?: string;
  gender?: "M" | "F";
  generation?: number | null;
  birth_year?: number | null;
  death_year?: number | null;
  is_living: boolean;
}

export async function peekLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<LinkPeek> {
  const { data, error } = await client.rpc("get_link_peek", {
    p_link_id: linkId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as LinkPeek;
}
