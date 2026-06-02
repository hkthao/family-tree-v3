/**
 * admin-action: privileged operations that the supabase REST API can't do
 * (or won't do safely) from a regular client (plan §8).
 *
 * Authn: caller passes their normal JWT in Authorization. We verify them
 * via Supabase auth, then check `profiles.is_platform_admin` ourselves.
 * Service-role auth.admin calls only fire after that check.
 *
 * Authz: only platform admins are allowed. No other role can hit this.
 *
 * Operations:
 *   - suspend (set is_suspended=true) + force sign-out so the JWT
 *     invalidates immediately.
 *   - unsuspend (clear is_suspended).
 *   - signout (drop active sessions without changing suspension state).
 *   - grant_platform_admin (toggle is_platform_admin true/false).
 *   - delete (drop from auth.users; cascades to profiles, clan_members).
 *
 * Request: POST JSON { action, target_user_id, ...flags }.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function err(message: string, status: number): Response {
  return json({ error: message }, { status });
}

interface RequestBody {
  action: "suspend" | "unsuspend" | "signout" | "grant_platform_admin" | "delete";
  target_user_id: string;
  /** for grant_platform_admin */
  grant?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  // 1. Validate the caller's JWT and check platform-admin status.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return err("Missing authorization", 401);

  const callerSb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userResp, error: userErr } = await callerSb.auth.getUser(token);
  if (userErr || !userResp.user) return err("Invalid token", 401);
  const callerId = userResp.user.id;

  // Read the caller's profile to check is_platform_admin via service role
  // (so RLS doesn't get in the way if something weird happens to the
  // self-select policy later).
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: prof, error: profErr } = await sb
    .from("profiles")
    .select("is_platform_admin, is_suspended")
    .eq("id", callerId)
    .maybeSingle();
  if (profErr) return err(profErr.message, 500);
  if (!prof?.is_platform_admin) return err("Forbidden", 403);
  if (prof.is_suspended) return err("Caller account is suspended", 403);

  // 2. Parse + dispatch.
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  if (!body.target_user_id) return err("Missing target_user_id", 400);

  // Refuse self-modification on destructive ops (a platform admin can
  // still adjust their own limits via the table directly).
  if (
    callerId === body.target_user_id &&
    (body.action === "delete" || body.action === "suspend")
  ) {
    return err("Cannot perform this action on yourself", 400);
  }

  try {
    switch (body.action) {
      case "suspend": {
        const { error: e1 } = await sb
          .from("profiles")
          .update({ is_suspended: true })
          .eq("id", body.target_user_id);
        if (e1) return err(e1.message, 500);
        // Invalidate active sessions so their JWT stops working immediately.
        await sb.auth.admin.signOut(body.target_user_id);
        return json({ ok: true });
      }
      case "unsuspend": {
        const { error: e1 } = await sb
          .from("profiles")
          .update({ is_suspended: false })
          .eq("id", body.target_user_id);
        if (e1) return err(e1.message, 500);
        return json({ ok: true });
      }
      case "signout": {
        await sb.auth.admin.signOut(body.target_user_id);
        return json({ ok: true });
      }
      case "grant_platform_admin": {
        const { error: e1 } = await sb
          .from("profiles")
          .update({ is_platform_admin: !!body.grant })
          .eq("id", body.target_user_id);
        if (e1) return err(e1.message, 500);
        return json({ ok: true });
      }
      case "delete": {
        const { error: e1 } = await sb.auth.admin.deleteUser(body.target_user_id);
        if (e1) return err(e1.message, 500);
        return json({ ok: true });
      }
      default:
        return err(`Unknown action: ${body.action}`, 400);
    }
  } catch (e) {
    return err((e as Error).message ?? "Unexpected error", 500);
  }
});
