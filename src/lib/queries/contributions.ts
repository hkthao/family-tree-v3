import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type ContributionType = "edit_person" | "add_note" | "add_person";
export type ContributionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_info";

// ─── Proposed-data payload shapes ────────────────────────────────
// These are application-level contracts — Postgres stores them as
// opaque jsonb. The apply_contribution() RPC reads only the keys
// listed here, so adding new ones requires updating the function too.

export interface EditPersonChanges {
  full_name?: string;
  courtesy_name?: string | null;
  posthumous_name?: string | null;
  nickname?: string | null;
  gender?: "M" | "F";
  is_living?: boolean;
  birth_date?: string | null;
  birth_date_precision?: "day" | "month" | "year" | null;
  death_date?: string | null;
  death_date_precision?: "day" | "month" | "year" | null;
  birth_lunar_year?: number | null;
  birth_lunar_month?: number | null;
  birth_lunar_day?: number | null;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_anniv_lunar_month?: number | null;
  death_anniv_lunar_day?: number | null;
  birth_place?: string | null;
  burial_place?: string | null;
  bio?: string | null;
}

export interface EditPersonPayload {
  changes: EditPersonChanges;
  /** Snapshot of the original values at submit time — used by the
   *  admin diff view to highlight what actually changes. */
  original?: Partial<EditPersonChanges>;
}

export interface AddNotePayload {
  note_addition: string;
}

export interface AddPersonRelation {
  as: "spouse" | "child";
  of_person_id: string;
}

export interface AddPersonPayload {
  full_name: string;
  gender: "M" | "F";
  is_living?: boolean;
  birth_date?: string | null;
  birth_date_precision?: "day" | "month" | "year" | null;
  death_date?: string | null;
  death_date_precision?: "day" | "month" | "year" | null;
  bio?: string | null;
  birth_place?: string | null;
  burial_place?: string | null;
  relation?: AddPersonRelation;
}

export type ContributionPayload =
  | { kind: "edit_person"; data: EditPersonPayload }
  | { kind: "add_note"; data: AddNotePayload }
  | { kind: "add_person"; data: AddPersonPayload };

// ─── Row shape ───────────────────────────────────────────────────

export interface ContributionRow {
  id: string;
  clan_id: string;
  person_id: string | null;
  contribution_type: ContributionType;
  proposed_data: unknown;
  submitter_user_id: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
  submitter_relation: string | null;
  submitter_note: string | null;
  status: ContributionStatus;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

// ─── Notify helper (fire-and-forget) ─────────────────────────────

/**
 * Trigger the notify-contribution edge function for a contribution.
 * The function reads the row's current status and dispatches the
 * appropriate email — admins for pending, submitter for resolved.
 *
 * Fire-and-forget: a network blip / Resend outage must not break
 * the submit/approve flow. Errors are swallowed; the worst case is
 * a missed notification, which the in-app badge already covers.
 */
function notifyContribution(id: string): void {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return;
  fetch(`${base}/functions/v1/notify-contribution`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ contribution_id: id }),
  }).catch(() => {
    // Intentionally silent — see jsdoc above.
  });
}

// ─── Submit (authenticated members) ──────────────────────────────

export interface SubmitContributionInput {
  clan_id: string;
  person_id?: string | null;
  contribution_type: ContributionType;
  proposed_data: unknown;
  /** Self-attribution: how the submitter relates to the person, e.g.
   *  "cháu nội", "khách". */
  submitter_relation?: string | null;
  submitter_note?: string | null;
}

/**
 * Insert a contribution as the currently authenticated user. RLS
 * pins submitter_user_id to auth.uid() so impersonation is blocked.
 *
 * Guests (no auth) go through the submit-contribution Edge Function
 * with the service role; this client helper is for logged-in
 * members only.
 */
export async function submitContribution(
  input: SubmitContributionInput,
  userId: string,
  client: Client = defaultClient,
): Promise<ContributionRow> {
  const { data, error } = await client
    .from("contributions")
    .insert({
      clan_id: input.clan_id,
      person_id: input.person_id ?? null,
      contribution_type: input.contribution_type,
      proposed_data: input.proposed_data as never,
      submitter_user_id: userId,
      submitter_relation: input.submitter_relation ?? null,
      submitter_note: input.submitter_note ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = data as ContributionRow;
  notifyContribution(row.id);
  return row;
}

// ─── Submit (guest via share link) ───────────────────────────────

export interface SubmitGuestContributionInput {
  /** share_link token from /share/:token URL. */
  token: string;
  contribution_type: ContributionType;
  person_id?: string | null;
  proposed_data: unknown;
  submitter_name: string;
  submitter_contact?: string;
  submitter_relation: string;
  submitter_note?: string;
}

/**
 * Anonymous submission path. The guest is viewing the clan through a
 * share link and has no auth — the edge function validates the link,
 * rate-limits by IP, and inserts the row via the service role.
 */
export async function submitGuestContribution(
  input: SubmitGuestContributionInput,
): Promise<{ id: string }> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${base}/functions/v1/submit-contribution`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `submit-contribution (${res.status})`);
  }
  return res.json();
}

// ─── List + read ─────────────────────────────────────────────────

export interface ListContributionsParams {
  status?: ContributionStatus | "all";
}

export async function listContributions(
  clanId: string,
  params: ListContributionsParams = {},
  client: Client = defaultClient,
): Promise<ContributionRow[]> {
  let q = client
    .from("contributions")
    .select("*")
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false });
  if (params.status && params.status !== "all") {
    q = q.eq("status", params.status);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContributionRow[];
}

export async function getContribution(
  id: string,
  client: Client = defaultClient,
): Promise<ContributionRow | null> {
  const { data, error } = await client
    .from("contributions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContributionRow) ?? null;
}

/**
 * Count of pending contributions for the drawer badge.
 * RLS already filters to clans the user can see.
 */
export async function countPendingContributions(
  clanId: string,
  client: Client = defaultClient,
): Promise<number> {
  const { count, error } = await client
    .from("contributions")
    .select("id", { count: "exact", head: true })
    .eq("clan_id", clanId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ─── Review (admin) ──────────────────────────────────────────────

export async function approveContribution(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("apply_contribution", { p_id: id });
  if (error) throw new Error(error.message);
  notifyContribution(id);
}

export async function rejectContribution(
  id: string,
  status: "rejected" | "needs_info",
  note: string | null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("reject_contribution", {
    p_id: id,
    p_status: status,
    // RPC accepts NULL via DEFAULT; generated types narrow it to
    // string — cast through unknown to keep client API ergonomic.
    p_note: (note ?? undefined) as string | undefined,
  });
  if (error) throw new Error(error.message);
  notifyContribution(id);
}
