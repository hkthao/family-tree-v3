/**
 * send-test-push: dispatch a one-shot test notification to the
 * caller's own push subscriptions. Used by the /account "Gửi thông
 * báo test" button so users can verify push end-to-end without
 * waiting for a cron-driven event.
 *
 * Auth: the caller's JWT (Authorization: Bearer …) — we use it to
 * identify the user via supabase.auth.getUser(). The user's
 * push_subscriptions are then read via service_role.
 *
 * Idempotency: none — every call sends a fresh push. Acceptable
 * because the test endpoint is gated by the user's own JWT (rate
 * limit lives in the UI by disabling the button while in-flight).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@giapha.local";
const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "http://localhost:5173";

const PUSH_READY = !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
if (PUSH_READY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return json({ error: "method-not-allowed" }, { status: 405 });
  }
  if (!PUSH_READY) {
    return json(
      { error: "push-not-configured (VAPID_* missing)" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  // Identify caller via their JWT.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u?.user?.id) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = u.user.id;

  // Fetch the caller's push subscriptions via service role.
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: subs, error: sErr } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", userId);
  if (sErr) return json({ error: sErr.message }, { status: 500 });

  const subList =
    (subs ?? []) as Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      failure_count: number;
    }>;
  if (subList.length === 0) {
    return json(
      { ok: false, sent: 0, message: "no-subscriptions" },
      { status: 404 },
    );
  }

  const payload = JSON.stringify({
    title: "Test thông báo Gia phả",
    body: "Push hoạt động bình thường — bạn sẽ nhận nhắc giỗ/đóng góp tương tự thế này.",
    url: `${APP_BASE_URL}/account`,
    tag: "test-push",
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const s of subList) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        payload,
        { TTL: 60 },
      );
      await sb
        .from("push_subscriptions")
        .update({
          last_success_at: new Date().toISOString(),
          failure_count: 0,
        })
        .eq("id", s.id);
      sent++;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 404 || err.statusCode === 410) {
        await sb.from("push_subscriptions").delete().eq("id", s.id);
      }
      failed++;
      if (err.message) errors.push(err.message);
    }
  }

  return json({ ok: sent > 0, sent, failed, errors: errors.slice(0, 3) });
});
