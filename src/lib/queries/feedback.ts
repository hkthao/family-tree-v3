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
