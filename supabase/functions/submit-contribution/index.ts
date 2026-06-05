/**
 * submit-contribution: anonymous contribution intake via share link.
 *
 * Guests viewing a clan through /share/:token can propose edits or
 * additions without an account. The Edge Function:
 *   1. Validates the share link (existence, not revoked, not expired).
 *   2. Validates that the target person_id belongs to the same clan
 *      as the share link (prevents cross-clan poisoning).
 *   3. Rate-limits the IP — max 5 contributions / 10 minutes — so a
 *      single guest can't flood the admin queue.
 *   4. Required-field check: name + relation + at least one of
 *      (contact, note) must be present so admins have something to
 *      verify.
 *   5. Inserts via the service role (bypasses RLS) and records the IP.
 *
 * Authenticated members do NOT come through this path — they call
 * the supabase-js client directly and submitter_user_id is pinned by
 * the RLS policy.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_PER_WINDOW = 5;
const RATE_WINDOW_MIN = 10;

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

function err(message: string, status: number): Response {
  return json({ error: message }, { status });
}

type ContributionType = "edit_person" | "add_note" | "add_person";

interface Body {
  token: string;
  contribution_type: ContributionType;
  person_id?: string | null;
  proposed_data: unknown;
  submitter_name: string;
  submitter_contact?: string;
  submitter_relation: string;
  submitter_note?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err("Body không hợp lệ", 400);
  }

  // ─── Required-field check ───────────────────────────────────────
  if (!body.token || typeof body.token !== "string") {
    return err("Thiếu token", 400);
  }
  if (
    !["edit_person", "add_note", "add_person"].includes(body.contribution_type)
  ) {
    return err("Loại đóng góp không hợp lệ", 400);
  }
  if (!body.submitter_name?.trim()) {
    return err("Cần tên người gửi", 400);
  }
  if (!body.submitter_relation?.trim()) {
    return err("Cần ghi quan hệ với người được đề xuất", 400);
  }
  if (!body.submitter_contact?.trim() && !body.submitter_note?.trim()) {
    return err("Cần email/sđt liên hệ hoặc ghi chú", 400);
  }
  if (!body.proposed_data) {
    return err("Thiếu nội dung đề xuất", 400);
  }

  // ─── Validate share link ────────────────────────────────────────
  const { data: link, error: linkErr } = await sb
    .from("share_links")
    .select("clan_id, root_person_id, expires_at, is_revoked, scope")
    .eq("token", body.token)
    .maybeSingle();
  if (linkErr) return err(linkErr.message, 500);
  if (!link) return err("Link không tồn tại", 404);
  if (link.is_revoked) return err("Link đã bị thu hồi", 410);
  if (new Date(link.expires_at) < new Date()) {
    return err("Link đã hết hạn", 410);
  }

  // ─── Validate person_id belongs to the same clan ───────────────
  if (body.person_id) {
    const { data: person, error: pErr } = await sb
      .from("persons")
      .select("clan_id, deleted_at")
      .eq("id", body.person_id)
      .maybeSingle();
    if (pErr) return err(pErr.message, 500);
    if (!person || person.deleted_at) {
      return err("Không tìm thấy người này", 404);
    }
    if (person.clan_id !== link.clan_id) {
      return err("Người này không thuộc dòng họ", 403);
    }
  }

  // ─── Rate limit by IP ────────────────────────────────────────────
  const windowStart = new Date(
    Date.now() - RATE_WINDOW_MIN * 60_000,
  ).toISOString();
  const { count: recentCount } = await sb
    .from("contributions")
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip", ip)
    .gt("created_at", windowStart);
  if ((recentCount ?? 0) >= RATE_PER_WINDOW) {
    return err(
      `Bạn đã gửi nhiều đóng góp trong ${RATE_WINDOW_MIN} phút qua. Vui lòng thử lại sau.`,
      429,
    );
  }

  // ─── Insert ─────────────────────────────────────────────────────
  const { data: row, error: insErr } = await sb
    .from("contributions")
    .insert({
      clan_id: link.clan_id,
      person_id: body.person_id ?? null,
      contribution_type: body.contribution_type,
      proposed_data: body.proposed_data,
      submitter_user_id: null,
      submitter_name: body.submitter_name.trim(),
      submitter_contact: body.submitter_contact?.trim() || null,
      submitter_relation: body.submitter_relation.trim(),
      submitter_note: body.submitter_note?.trim() || null,
      submitter_ip: ip,
    })
    .select("id")
    .single();
  if (insErr) return err(insErr.message, 500);

  return json({ ok: true, id: row?.id });
});
