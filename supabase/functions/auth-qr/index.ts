/**
 * auth-qr: returns a single-use magic-link URL for the caller's
 * own account, so the desktop web can show it as a QR code and
 * the user's phone (already pointed at giapha.thaohk.com) can
 * scan + sign in without typing a password.
 *
 * Flow:
 *   1. Caller hits POST /functions/v1/auth-qr with their JWT.
 *   2. We read the user from the JWT, call
 *      supabase.auth.admin.generateLink({ type: "magiclink" })
 *      which mints a magic link WITHOUT sending an email.
 *   3. Return { url } — caller renders as QR.
 *
 * Security note: the returned link is as powerful as a password
 * reset link. Don't log it. Caller UI should warn the user not
 * to screenshot / share + auto-rotate every minute or two.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Land directly on /clans so the URL fragment / code survives — see
// SocialAuthButtons comment for the race the `/` root-redirect causes.
const SITE_URL =
  Deno.env.get("AUTH_QR_SITE_URL") ?? "https://giapha.thaohk.com/clans";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function err(msg: string, status: number): Response {
  return json({ error: msg }, { status });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return err("Missing JWT", 401);
  const jwt = auth.slice(7);

  // 1. Identify caller via their JWT.
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !user?.email) return err("Invalid session", 401);

  // 2. Mint a magic link WITHOUT triggering an email send. The
  // admin API's generateLink returns the link itself; we never
  // dispatch via SMTP.
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo: SITE_URL },
  });
  if (error || !data?.properties?.action_link) {
    return err(`generateLink: ${error?.message ?? "unknown"}`, 500);
  }

  return json({
    url: data.properties.action_link,
    // Reflect what the client should display so QR rotation
    // can run on a known TTL. Default Supabase magic-link
    // expiry is 1h but anything shorter is safer for QR.
    ttl_seconds: 300,
  });
});
