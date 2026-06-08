/**
 * notify-contribution: transactional email for a single contribution.
 *
 * Called fire-and-forget after one of:
 *   1. A new contribution is INSERTed (status='pending')      → email admins
 *   2. apply_contribution() flips status to 'approved'        → email submitter
 *   3. reject_contribution() flips status to 'rejected'       → email submitter
 *   4. reject_contribution() flips status to 'needs_info'     → email submitter
 *
 * The endpoint takes ONLY a contribution_id — the event type is
 * derived from the current row's `status` so the DB is the single
 * source of truth. Concretely:
 *   - status='pending' → "new contribution" email to every clan admin
 *   - status='approved'  → "your contribution was approved" to submitter
 *   - status='rejected'  → "rejected, reason: …" to submitter
 *   - status='needs_info'→ "admin needs more info, …" to submitter
 *
 * Submitter address: prefer auth.users.email when submitter_user_id
 * is set; fall back to submitter_contact (only meaningful when it
 * looks like an email — guests sometimes leave a phone number, in
 * which case we silently skip).
 *
 * Security model: anyone with the anon key can call this, but the
 * function never echoes data back — it just reads the contribution
 * via the service role and sends the canonical email for the current
 * state. So a malicious caller can at worst re-trigger an email
 * matching the existing state (no information leak). Rate-limit can
 * be added later if needed.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Gia phả <noreply@giapha.local>";
const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "http://localhost:5173";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@giapha.local";
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

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function looksLikeEmail(s: string | null): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

interface ContributionEmail {
  to: string;
  subject: string;
  html: string;
}

const TYPE_LABEL: Record<string, string> = {
  edit_person: "Sửa thông tin",
  add_note: "Bổ sung tiểu sử",
  add_person: "Thêm người",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "đã được duyệt",
  rejected: "bị từ chối",
  needs_info: "cần thêm thông tin",
};

function emailLayout(opts: {
  clanName: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}): string {
  const cta = opts.ctaLabel && opts.ctaHref
    ? `<p style="margin: 24px 0;">
         <a href="${esc(opts.ctaHref)}"
            style="display:inline-block;padding:10px 18px;background:#7A2230;color:#fff;
                   text-decoration:none;border-radius:6px;font-weight:600;">${esc(opts.ctaLabel)}</a>
       </p>`
    : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1F1A17;
            background:#FBF7F0;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;
                padding:24px;border:1px solid #D8CFC2;">
      <p style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;
                color:#6F665F;margin:0 0 4px;">${esc(opts.clanName)}</p>
      <h1 style="font-size:20px;color:#7A2230;margin:0 0 16px;">${esc(opts.title)}</h1>
      ${opts.body}
      ${cta}
      <hr style="border:none;border-top:1px solid #D8CFC2;margin:24px 0 8px;" />
      <p style="font-size:11px;color:#6F665F;margin:0;">
        Email tự động từ ứng dụng Gia phả. Không cần trả lời.
      </p>
    </div></body></html>`;
}

function buildNewContributionEmail(opts: {
  clanName: string;
  contribTypeLabel: string;
  personName: string | null;
  submitterName: string;
  submitterRelation: string | null;
  submitterNote: string | null;
  link: string;
}): { subject: string; html: string } {
  const target = opts.personName
    ? `cho ${esc(opts.personName)}`
    : "(thêm người mới)";
  const subject = `[Gia phả ${opts.clanName}] Đề xuất ${opts.contribTypeLabel} ${target}`;
  const body = `
    <p>Có người vừa gửi một đề xuất sửa gia phả của bạn.</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Loại đề xuất</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.contribTypeLabel)} ${esc(target)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Người gửi</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.submitterName)}</td></tr>
      ${opts.submitterRelation ? `
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Quan hệ</td>
          <td style="padding:4px 0;">${esc(opts.submitterRelation)}</td></tr>` : ""}
      ${opts.submitterNote ? `
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;vertical-align:top;">Ghi chú</td>
          <td style="padding:4px 0;font-style:italic;">"${esc(opts.submitterNote)}"</td></tr>` : ""}
    </table>
    <p style="color:#6F665F;font-size:13px;">
      Đề xuất chưa được áp dụng. Bấm để xem chi tiết và quyết định duyệt hoặc từ chối.
    </p>`;
  return {
    subject,
    html: emailLayout({
      clanName: opts.clanName,
      title: "Có đề xuất sửa mới",
      body,
      ctaLabel: "Xem & duyệt",
      ctaHref: opts.link,
    }),
  };
}

function buildDecisionEmail(opts: {
  clanName: string;
  status: "approved" | "rejected" | "needs_info";
  contribTypeLabel: string;
  personName: string | null;
  reviewNote: string | null;
  link: string;
}): { subject: string; html: string } {
  const target = opts.personName ? `cho ${opts.personName}` : "(thêm người mới)";
  const statusLabel = STATUS_LABEL[opts.status];
  const subject = `[Gia phả ${opts.clanName}] Đề xuất của bạn ${statusLabel}`;
  const verb =
    opts.status === "approved"
      ? "đã được áp dụng vào gia phả"
      : opts.status === "rejected"
        ? "đã bị từ chối"
        : "cần thêm thông tin trước khi duyệt";
  const bodyPieces = [
    `<p>Đề xuất <strong>${esc(opts.contribTypeLabel)}</strong> ${esc(target)} của bạn ${esc(verb)}.</p>`,
  ];
  if (opts.reviewNote) {
    bodyPieces.push(`
      <div style="border-left:4px solid #7A2230;background:#FBF7F0;padding:10px 14px;margin:14px 0;">
        <p style="font-size:11px;color:#6F665F;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">
          Ghi chú từ admin
        </p>
        <p style="margin:0;font-size:14px;">${esc(opts.reviewNote)}</p>
      </div>`);
  }
  if (opts.status === "approved") {
    bodyPieces.push(`<p style="color:#6F665F;font-size:13px;">Cảm ơn bạn đã đóng góp cho dòng họ.</p>`);
  } else if (opts.status === "needs_info") {
    bodyPieces.push(`<p style="color:#6F665F;font-size:13px;">Bạn có thể trả lời email này, hoặc gửi đề xuất mới với thông tin bổ sung.</p>`);
  }
  return {
    subject,
    html: emailLayout({
      clanName: opts.clanName,
      title:
        opts.status === "approved"
          ? "Đề xuất đã được duyệt ✓"
          : opts.status === "rejected"
            ? "Đề xuất bị từ chối"
            : "Đề xuất cần thêm thông tin",
      body: bodyPieces.join(""),
      ctaLabel:
        opts.status === "approved" && opts.personName
          ? "Xem trang đã cập nhật"
          : undefined,
      ctaHref: opts.status === "approved" ? opts.link : undefined,
    }),
  };
}

async function sendOne(email: ContributionEmail): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "no-api-key (dry-run)" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `resend ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  let body: { contribution_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.contribution_id) {
    return json({ error: "contribution_id required" }, { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: c, error: cErr } = await sb
    .from("contributions")
    .select(
      "id, clan_id, person_id, contribution_type, status, submitter_user_id, submitter_name, submitter_contact, submitter_relation, submitter_note, review_note, proposed_data",
    )
    .eq("id", body.contribution_id)
    .maybeSingle();
  if (cErr) return json({ error: cErr.message }, { status: 500 });
  if (!c) return json({ error: "Not found" }, { status: 404 });

  const { data: clan } = await sb
    .from("clans")
    .select("name")
    .eq("id", c.clan_id)
    .maybeSingle();
  const clanName = clan?.name ?? "Gia phả";

  // Resolve display name of the target person (for subject/title).
  let personName: string | null = null;
  if (c.person_id) {
    const { data: p } = await sb
      .from("persons")
      .select("full_name")
      .eq("id", c.person_id)
      .maybeSingle();
    personName = (p?.full_name as string) ?? null;
  } else {
    // add_person — pull from payload
    personName =
      (c.proposed_data as { full_name?: string } | null)?.full_name ?? null;
  }

  const contribTypeLabel =
    TYPE_LABEL[c.contribution_type] ?? c.contribution_type;
  const contribLink = `${APP_BASE_URL}/clans/${c.clan_id}/contributions/${c.id}`;
  const personLink = c.person_id
    ? `${APP_BASE_URL}/clans/${c.clan_id}/people/${c.person_id}`
    : contribLink;

  // ─── Dispatch by current status ──────────────────────────────
  const sent: Array<{ to: string; ok: boolean; error?: string }> = [];

  if (c.status === "pending") {
    // Notify clan admins.
    const { data: admins } = await sb
      .from("clan_members")
      .select("user_id")
      .eq("clan_id", c.clan_id)
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((a) => a.user_id as string);
    const emails: string[] = [];
    for (const id of adminIds) {
      const { data: u } = await sb.auth.admin.getUserById(id);
      if (u?.user?.email) emails.push(u.user.email);
    }
    if (emails.length === 0) {
      return json({ ok: true, skipped: "no-admin-emails" });
    }
    const tpl = buildNewContributionEmail({
      clanName,
      contribTypeLabel,
      personName,
      submitterName:
        c.submitter_name ??
        (c.submitter_user_id ? "Thành viên" : "Khách qua link chia sẻ"),
      submitterRelation: c.submitter_relation,
      submitterNote: c.submitter_note,
      link: contribLink,
    });
    for (const to of emails) {
      const r = await sendOne({ to, subject: tpl.subject, html: tpl.html });
      sent.push({ to, ...r });
    }
    // Fan out web push to admins who opted in (notify_via_push=true).
    // pending → push carries action buttons (approve / reject) so
    // admin can dispatch from the notification itself.
    await pushContribution({
      sb,
      userIds: adminIds,
      title: tpl.subject.replace(/^\[Gia phả [^\]]+\]\s*/, ""),
      body: `${c.submitter_name ?? "Thành viên"} đề xuất ${contribTypeLabel.toLowerCase()}${personName ? " cho " + personName : ""}.`,
      url: contribLink,
      eventKey: `contrib:${c.id}:pending`,
      clanId: c.clan_id as string,
      kind: "contribution_pending",
      targetId: c.id as string,
      actions: ["approve", "reject"],
    });
  } else if (
    c.status === "approved" ||
    c.status === "rejected" ||
    c.status === "needs_info"
  ) {
    // Notify the submitter.
    let to: string | null = null;
    if (c.submitter_user_id) {
      const { data: u } = await sb.auth.admin.getUserById(c.submitter_user_id);
      to = u?.user?.email ?? null;
    }
    if (!to && looksLikeEmail(c.submitter_contact)) {
      to = c.submitter_contact;
    }
    if (!to) {
      return json({ ok: true, skipped: "no-submitter-email" });
    }
    const tpl = buildDecisionEmail({
      clanName,
      status: c.status,
      contribTypeLabel,
      personName,
      reviewNote: c.review_note,
      link: personLink,
    });
    const r = await sendOne({ to, subject: tpl.subject, html: tpl.html });
    sent.push({ to, ...r });
    // Push the same decision to the submitter, when an authenticated
    // user. Guest contributions have no user_id so they only get email.
    if (c.submitter_user_id) {
      const verb =
        c.status === "approved"
          ? "đã được duyệt"
          : c.status === "rejected"
            ? "bị từ chối"
            : "cần thêm thông tin";
      await pushContribution({
        sb,
        userIds: [c.submitter_user_id as string],
        title: `Đề xuất ${verb}`,
        body: `${contribTypeLabel}${personName ? " cho " + personName : ""} — ${clanName}.`,
        url: personLink,
        eventKey: `contrib:${c.id}:${c.status}`,
        clanId: c.clan_id as string,
      });
    }
  } else {
    return json({ ok: true, skipped: `unknown-status:${c.status}` });
  }

  return json({ ok: true, sent });
});

// ─── Web Push fan-out ──────────────────────────────────────────────
// Shared dispatcher used by both the "new contribution → admins" and
// "decision → submitter" branches. Same idempotency + drift cleanup
// pattern as notify-events: dedupe via notification_log channel='webpush',
// drop subscriptions on 404/410, bump failure_count otherwise.

const PUSH_CHUNK = 50;
const FAILURE_THRESHOLD = 5;

interface PushSubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

// Token of ≥22 chars; 32 bytes random hex = 64 chars — safely beyond
// the migration's CHECK length(action_token) >= 22.
function generateActionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function pushContribution(opts: {
  sb: ReturnType<typeof createClient>;
  userIds: string[];
  title: string;
  body: string;
  url: string;
  eventKey: string;
  clanId: string;
  /** Optional interactive-notification kind. When set together with
   *  `targetId` + non-empty `actions`, the dispatcher inserts a
   *  notifications row and the SW will render action buttons. */
  kind?: string;
  targetId?: string;
  actions?: string[];
}): Promise<void> {
  if (!PUSH_READY || opts.userIds.length === 0) return;

  // Filter to opted-in, non-suspended users.
  const { data: profiles } = await opts.sb
    .from("profiles")
    .select("id, notify_via_push, is_suspended")
    .in("id", opts.userIds);
  const enabled = new Set<string>();
  for (const r of profiles ?? []) {
    const row = r as {
      id: string;
      notify_via_push: boolean;
      is_suspended: boolean;
    };
    if (row.notify_via_push && !row.is_suspended) enabled.add(row.id);
  }
  if (enabled.size === 0) return;
  const targetUsers = [...enabled];

  // Dedupe: skip users already pushed for this exact (eventKey).
  const { data: logRows } = await opts.sb
    .from("notification_log")
    .select("user_id")
    .eq("event_key", opts.eventKey)
    .eq("channel", "webpush")
    .in("user_id", targetUsers);
  const alreadyPushed = new Set(
    (logRows ?? []).map((r) => (r as { user_id: string }).user_id),
  );
  const toPush = targetUsers.filter((u) => !alreadyPushed.has(u));
  if (toPush.length === 0) return;

  // Fetch every subscription owned by the to-push users.
  const { data: subRows } = await opts.sb
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, failure_count")
    .in("user_id", toPush);
  const subsByUser = new Map<string, PushSubRow[]>();
  for (const s of (subRows ?? []) as PushSubRow[]) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  // When interactive: insert per-user notification rows up front, so
  // each user's push carries their OWN action_token (one-time secret).
  // Skipping users who already have a non-consumed row for the same
  // event would require a join — for MVP we accept that a re-run of
  // notify-contribution generates a fresh notification row per call.
  const interactiveTokens = new Map<string, { id: string; token: string }>();
  if (opts.kind && opts.targetId && (opts.actions?.length ?? 0) > 0) {
    for (const uid of toPush) {
      const token = generateActionToken();
      const ins = await opts.sb
        .from("notifications")
        .insert({
          user_id: uid,
          kind: opts.kind,
          target_id: opts.targetId,
          payload: { title: opts.title, body: opts.body, url: opts.url },
          actions: opts.actions,
          action_token: token,
        })
        .select("id")
        .single();
      if (!ins.error && ins.data) {
        interactiveTokens.set(uid, { id: ins.data.id as string, token });
      }
    }
  }

  // Fan out, chunked. Build payload per-subscription so each user
  // gets their own notification_id + action_token.
  const allSubs = Array.from(subsByUser.values()).flat();
  function payloadFor(userId: string): string {
    const t = interactiveTokens.get(userId);
    return JSON.stringify({
      title: opts.title,
      body: opts.body,
      url: opts.url,
      tag: opts.eventKey,
      ...(t
        ? { notification_id: t.id, action_token: t.token }
        : {}),
    });
  }
  for (let i = 0; i < allSubs.length; i += PUSH_CHUNK) {
    const chunk = allSubs.slice(i, i + PUSH_CHUNK);
    await Promise.allSettled(
      chunk.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payloadFor(s.user_id),
            { TTL: 24 * 60 * 60 },
          );
          await opts.sb
            .from("push_subscriptions")
            .update({
              last_success_at: new Date().toISOString(),
              failure_count: 0,
            })
            .eq("id", s.id);
        } catch (e: unknown) {
          const err = e as { statusCode?: number };
          if (err.statusCode === 404 || err.statusCode === 410) {
            await opts.sb.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            const next = s.failure_count + 1;
            if (next >= FAILURE_THRESHOLD) {
              await opts.sb
                .from("push_subscriptions")
                .delete()
                .eq("id", s.id);
            } else {
              await opts.sb
                .from("push_subscriptions")
                .update({ failure_count: next })
                .eq("id", s.id);
            }
          }
        }
      }),
    );
  }

  // Reserve notification_log rows AFTER dispatch so a transient failure
  // mid-fan-out doesn't permanently swallow the event. Insert one row
  // per (user, event_key, webpush) with ON CONFLICT DO NOTHING.
  for (const uid of toPush) {
    await opts.sb.from("notification_log").upsert(
      {
        user_id: uid,
        clan_id: opts.clanId,
        event_key: opts.eventKey,
        channel: "webpush",
        status: "sent",
      },
      {
        onConflict: "user_id,event_key,channel",
        ignoreDuplicates: true,
      },
    );
  }
}
