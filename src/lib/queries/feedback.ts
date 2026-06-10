import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface SubmitFeedbackInput {
  message: string;
  /** Free-form: email / phone / zalo. Optional. */
  contact?: string | null;
  /** The clan the user was looking at when they opened the form. */
  clanId?: string | null;
  /** location.href at submit time. */
  pageUrl?: string | null;
}

/**
 * Write a feedback row. Works for both authenticated callers (we
 * stamp `user_id` from `auth.getUser`) and anon visitors (`user_id`
 * stays null — the RLS policy allows either).
 *
 * `user_agent` + `app_version` are auto-collected so a one-word
 * "trang trắng" report is still actionable. Returns nothing — the
 * caller's toast is the ack.
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
  client: Client = defaultClient,
): Promise<void> {
  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id ?? null;
  const userAgent =
    typeof navigator === "undefined" ? null : navigator.userAgent;
  // Vite substitutes these at build time — see vite.config.ts.
  const appVersion = `${__APP_VERSION__}+${__APP_COMMIT__}`;

  const { error } = await client.from("feedback").insert({
    user_id: userId,
    clan_id: input.clanId ?? null,
    message: input.message,
    contact: input.contact ?? null,
    page_url: input.pageUrl ?? null,
    user_agent: userAgent,
    app_version: appVersion,
  });
  if (error) throw new Error(error.message);
}

export interface FeedbackRow {
  id: string;
  user_id: string | null;
  clan_id: string | null;
  message: string;
  contact: string | null;
  page_url: string | null;
  user_agent: string | null;
  app_version: string | null;
  created_at: string;
}

/**
 * Admin-only firehose. RLS already gates SELECT to platform admins;
 * a non-admin caller gets back an empty array (the policy filters
 * row-by-row, no error). Newest first.
 *
 * Capped at 500 — cheap to read, and if we ever blow past that the
 * UX needs date-range filters anyway.
 */
export async function listFeedback(
  limit = 500,
  client: Client = defaultClient,
): Promise<FeedbackRow[]> {
  const { data, error } = await client
    .from("feedback")
    .select(
      "id, user_id, clan_id, message, contact, page_url, user_agent, app_version, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackRow[];
}
