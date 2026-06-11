import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type FeedbackCategory = "bug" | "idea" | "question" | "other";
export type FeedbackStatus = "new" | "seen" | "resolved" | "spam";

export interface SubmitFeedbackInput {
  message: string;
  /** Phân loại — bug/idea/question/other. Mặc định 'other'. */
  category?: FeedbackCategory;
  /** Free-form: email / phone / zalo. Optional. */
  contact?: string | null;
  /** The clan the user was looking at when they opened the form. */
  clanId?: string | null;
  /** location.href at submit time — DB tự sanitize → page_path. */
  pageUrl?: string | null;
}

/**
 * Write a feedback row. Works for both authenticated callers (we
 * stamp `user_id` from `auth.getUser`) and anon visitors (`user_id`
 * stays null — the RLS policy allows either).
 *
 * `user_agent` + `app_version` are auto-collected so a one-word
 * "trang trắng" report is still actionable. `page_url` được
 * sanitize ở DB thành `page_path` (xem migration §32.4).
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
    category: input.category ?? "other",
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
  category: FeedbackCategory;
  status: FeedbackStatus;
  contact: string | null;
  page_path: string | null;
  user_agent: string | null;
  app_version: string | null;
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const FEEDBACK_COLUMNS =
  "id, user_id, clan_id, message, category, status, contact, page_path, user_agent, app_version, admin_note, resolved_at, resolved_by, created_at";

/**
 * Admin-only firehose. RLS gates SELECT to platform admins; non-admin
 * caller gets empty array (policy filters row-by-row, no error).
 * Newest first.
 *
 * Capped at 500 — cheap to read, và nếu vượt qua thì UI cần thêm
 * date-range filters.
 */
export async function listFeedback(
  limit = 500,
  client: Client = defaultClient,
): Promise<FeedbackRow[]> {
  const { data, error } = await client
    .from("feedback")
    .select(FEEDBACK_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackRow[];
}

/**
 * Lịch sử "đã gửi" — user đọc lại feedback của chính mình. RLS
 * `feedback_select_owner` enforce.
 */
export async function listMyFeedback(
  client: Client = defaultClient,
): Promise<FeedbackRow[]> {
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return [];
  const { data, error } = await client
    .from("feedback")
    .select(FEEDBACK_COLUMNS)
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackRow[];
}

export interface UpdateFeedbackPatch {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  admin_note?: string | null;
}

/**
 * Platform admin sửa status / category / admin_note. Stamp
 * resolved_at/by khi status chuyển sang 'resolved'; clear khi đổi
 * sang trạng thái khác.
 */
export async function updateFeedback(
  id: string,
  patch: UpdateFeedbackPatch,
  client: Client = defaultClient,
): Promise<void> {
  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id ?? null;
  const payload: {
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    admin_note?: string | null;
    resolved_at?: string | null;
    resolved_by?: string | null;
  } = { ...patch };
  if (patch.status !== undefined) {
    if (patch.status === "resolved") {
      payload.resolved_at = new Date().toISOString();
      payload.resolved_by = userId;
    } else {
      payload.resolved_at = null;
      payload.resolved_by = null;
    }
  }
  const { error } = await client
    .from("feedback")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
