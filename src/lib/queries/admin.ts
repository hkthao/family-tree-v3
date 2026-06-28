import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface AdminProfileRow {
  id: string;
  display_name: string | null;
  is_platform_admin: boolean;
  is_suspended: boolean;
  max_clans: number;
  created_at: string;
  email: string | null; // resolved separately via get_profile_emails
}

export interface AdminClanRow {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  max_persons: number;
  max_users: number;
  owner_id: string | null;
  data_version: number;
  created_at: string;
  updated_at: string;
  person_count: number;
}

/**
 * RLS already allows `is_platform_admin()` to SELECT every profile row.
 * Email is fetched via the get_profile_emails RPC and merged in.
 */
export async function listAllProfiles(
  client: Client = defaultClient,
): Promise<AdminProfileRow[]> {
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, is_platform_admin, is_suspended, max_clans, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const profiles = (data ?? []) as Omit<AdminProfileRow, "email">[];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: emails, error: emailErr } = await client.rpc("get_profile_emails", {
    user_ids: ids,
  });
  if (emailErr) throw new Error(emailErr.message);
  const byId = new Map(
    (emails as { id: string; email: string }[] | null)?.map((e) => [e.id, e.email]) ?? [],
  );
  return profiles.map((p) => ({ ...p, email: byId.get(p.id) ?? null }));
}

export async function listAllClans(
  client: Client = defaultClient,
): Promise<AdminClanRow[]> {
  const { data, error } = await client
    .from("clans")
    .select(
      "id, name, description, visibility, max_persons, max_users, owner_id, data_version, created_at, updated_at, person_count",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminClanRow[];
}

/** List clan_members for a single user — used to show "what clans is X in". */
export async function listClansForUser(
  userId: string,
  client: Client = defaultClient,
): Promise<Array<{ clan_id: string; clan_name: string; role: string }>> {
  const { data, error } = await client
    .from("clan_members")
    .select("clan_id, role, clan:clans(name)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (r: { clan_id: string; role: string; clan: { name: string } | null }) => ({
      clan_id: r.clan_id,
      clan_name: r.clan?.name ?? "(?)",
      role: r.role,
    }),
  );
}

export async function updateProfileMaxClans(
  userId: string,
  maxClans: number,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ max_clans: maxClans })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateClanLimits(
  clanId: string,
  limits: { max_persons?: number; max_users?: number },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clans")
    .update(limits)
    .eq("id", clanId);
  if (error) throw new Error(error.message);
}

/**
 * Call the admin-action Edge Function. Caller's JWT travels via Supabase's
 * auth header automatically when we go through `client.functions.invoke`.
 *
 * functions.invoke wraps non-2xx responses into a generic FunctionsHttpError
 * that hides the response body's `error` field — we re-read the body so
 * users see the precise reason (e.g. "Cannot perform this action on
 * yourself") instead of the opaque wrapper text.
 */
// ─── Platform-wide DB stats (Health tab) ────────────────────────────

export interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: {
    status: string;
    start_time: string;
    end_time: string | null;
    return_message: string | null;
  } | null;
}

export interface FailedNotification {
  id: string;
  event_key: string;
  channel: "email" | "sms";
  sent_at: string;
  clan_id: string | null;
  clan_name: string | null;
  user_id: string | null;
  user_email: string | null;
}

export interface PlatformDbStats {
  rows: Record<string, number>;
  sizes_bytes: Record<string, number>;
  rates: {
    persons_24h?: number;
    persons_7d?: number;
    persons_30d?: number;
    clans_7d?: number;
    clans_30d?: number;
    users_7d?: number;
    users_30d?: number;
  };
  states: {
    contributions_pending: number;
    person_links_pending: number;
    share_links_active: number;
    notifications_failed_total: number;
    users_total: number;
    users_suspended: number;
  };
  cron: CronJobStatus[];
  recent_failed_notifications: FailedNotification[];
  generated_at: string;
}

export async function clearFailedNotification(
  notificationId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("clear_failed_notification", {
    p_id: notificationId,
  });
  if (error) throw new Error(error.message);
}

export async function getPlatformDbStats(
  client: Client = defaultClient,
): Promise<PlatformDbStats> {
  const { data, error } = await client.rpc("get_platform_db_stats");
  if (error) throw new Error(error.message);
  return data as unknown as PlatformDbStats;
}

export async function adminAction(
  body: {
    action: "suspend" | "unsuspend" | "signout" | "grant_platform_admin" | "delete";
    target_user_id: string;
    grant?: boolean;
  },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.functions.invoke("admin-action", { body });
  if (!error) return;

  const ctx = (error as { context?: Response }).context;
  if (ctx instanceof Response) {
    try {
      const parsed = await ctx.json();
      if (parsed && typeof parsed.error === "string") {
        throw new Error(parsed.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
    }
  }
  throw new Error(error.message);
}

// ─── Gia-phả import (vietnamgiapha.com → clan) ──────────────────────

export interface GiaPhaImportResult {
  ok: true;
  clanId: string;
  counts: { persons: number; families: number };
  warnings: { ambiguousMothers: number; missingGender: number; note: string };
}
export interface GiaPhaJobProgress {
  jobId: string;
  clanId: string;
  clanName?: string;
  total: number;
  scraped: number;
  status: "scraping" | "ready" | "importing" | "done" | "error";
}

/**
 * Invoke the staged giapha-import Edge Function. The import is a job:
 * `start` lists every person + creates the clan/job, `step` scrapes one
 * batch (call until status='ready'), `finalize` imports in one txn.
 * Splitting it this way keeps each call under the Edge timeout so even
 * a 5000-person tree imports, and the server-side job means a closed
 * tab can be resumed. Re-reads the error body for a precise message.
 */
// deno-lint-ignore-no-explicit-any not applicable (TS): use unknown-ish
async function invokeImport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
  client: Client,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { data, error } = await client.functions.invoke("giapha-import", { body });
  if (!error) return data;
  const ctx = (error as { context?: Response }).context;
  if (ctx instanceof Response) {
    try {
      const parsed = await ctx.json();
      if (parsed && typeof parsed.error === "string") throw new Error(parsed.error);
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
    }
  }
  throw new Error(error.message);
}

export function giaPhaImportStart(
  body: { sourceUrl: string; clanId?: string; clanName?: string; replace?: boolean },
  client: Client = defaultClient,
): Promise<GiaPhaJobProgress> {
  return invokeImport({ action: "start", ...body }, client);
}
export function giaPhaImportStep(
  jobId: string,
  client: Client = defaultClient,
): Promise<GiaPhaJobProgress> {
  return invokeImport({ action: "step", jobId }, client);
}
export function giaPhaImportFinalize(
  jobId: string,
  client: Client = defaultClient,
): Promise<GiaPhaImportResult> {
  return invokeImport({ action: "finalize", jobId }, client);
}

/**
 * Hard-delete every person + family of a clan (keeps the clan, members
 * and settings). Platform-admin only, irreversible — UI must confirm.
 */
export async function wipeClanDirectory(
  clanId: string,
  client: Client = defaultClient,
): Promise<{ deleted_persons: number; deleted_families: number }> {
  const { data, error } = await client.rpc("admin_wipe_clan_directory", {
    p_clan_id: clanId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { deleted_persons: number; deleted_families: number };
}
