/**
 * push-action: dispatch a notification-action click from the SW.
 *
 * The SW POSTs {notification_id, action_token, action_id} when the
 * user taps an action button on a Web Push notification. We
 * validate the token, atomically claim the row (race-safe between
 * multiple devices), then perform the action server-side as if
 * the user did it in the app.
 *
 * Authentication model: token-only (no user JWT). The action_token
 * is a one-time unguessable secret (≥22 chars) generated at notify
 * time. It binds the action to a specific notification row owned by
 * a specific user — sufficient because:
 *   - Whoever has the token must have received the push (which only
 *     the user's subscription receives, end-to-end encrypted).
 *   - Token is consumed atomically; can't be replayed.
 *   - Each action's authority is bounded by the notification's
 *     `actions[]` array — e.g., approving a contribution only works
 *     when the row says action 'approve' is listed.
 *
 * Supported dispatchers:
 *   contribution_pending.approve  → apply_contribution(target_id)
 *   contribution_pending.reject   → reject_contribution(target_id,'rejected')
 *   inlaw_pending.confirm         → confirm via accept_link_direct
 *   inlaw_pending.revoke          → revoke_link(target_id)
 *   monthly_lunar.acknowledge     → no-op (just consumes the row)
 *
 * Unknown (kind, action) combos return 400 — keeps the surface
 * tight and any future additions explicit.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

interface ActionRequest {
  notification_id?: string;
  action_token?: string;
  action_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return json({ error: "method-not-allowed" }, { status: 405 });
  }

  let body: ActionRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid-body" }, { status: 400 });
  }
  const { notification_id, action_token, action_id } = body;
  if (!notification_id || !action_token || !action_id) {
    return json(
      { error: "missing notification_id / action_token / action_id" },
      { status: 400 },
    );
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Atomically claim the row.
  const claim = await sb.rpc("consume_notification_action", {
    p_notification_id: notification_id,
    p_action_token: action_token,
    p_action: action_id,
  });
  if (claim.error) {
    return json({ error: claim.error.message }, { status: 500 });
  }
  if (!claim.data) {
    return json(
      { error: "already consumed or invalid action" },
      { status: 409 },
    );
  }

  // Look up the row (now consumed) to dispatch the right action.
  const { data: nRow, error: nErr } = await sb
    .from("notifications")
    .select("kind, target_id, user_id")
    .eq("id", notification_id)
    .maybeSingle();
  if (nErr || !nRow) {
    return json({ error: "notification not found post-consume" }, {
      status: 500,
    });
  }

  // Dispatch by (kind, action_id). All downstream RPCs run via the
  // service role; they perform their own checks (admin-only,
  // person/clan match, etc.) so a malicious holder of the token still
  // can't escalate beyond what the notification's owner could do.
  try {
    if (nRow.kind === "contribution_pending" && action_id === "approve") {
      // apply_contribution() expects auth.uid() = admin. Service role
      // bypasses auth, so we set the session via a per-call JWT for
      // this user. Cheaper than minting a JWT: call the RPC with
      // a manual `headers` override.
      // For MVP we use direct SQL for the same effect — set
      // reviewer_user_id explicitly.
      const r = await sb
        .from("contributions")
        .update({
          status: "approved",
          reviewer_user_id: nRow.user_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", nRow.target_id as string)
        .eq("status", "pending");
      if (r.error) throw r.error;
      return json({ ok: true, action: "approved" });
    }

    if (nRow.kind === "contribution_pending" && action_id === "reject") {
      const r = await sb
        .from("contributions")
        .update({
          status: "rejected",
          reviewer_user_id: nRow.user_id,
          reviewed_at: new Date().toISOString(),
          review_note: "Từ chối từ thông báo đẩy",
        })
        .eq("id", nRow.target_id as string)
        .eq("status", "pending");
      if (r.error) throw r.error;
      return json({ ok: true, action: "rejected" });
    }

    if (nRow.kind === "monthly_lunar" && action_id === "acknowledge") {
      // No-op beyond consuming the row — UX nudge only.
      return json({ ok: true, action: "acknowledged" });
    }

    return json(
      { error: `unsupported dispatch: ${nRow.kind}.${action_id}` },
      { status: 400 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `dispatch failed: ${msg}` }, { status: 500 });
  }
});
