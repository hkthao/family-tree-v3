/**
 * notify-inlaw: transactional email for cross-clan in-law links.
 *
 * Called fire-and-forget after a link's state changes. The endpoint
 * takes ONLY a `link_id`; the email type is derived from the current
 * row's status (DB = single source of truth, same pattern as
 * notify-contribution):
 *   - status='pending'   AND clan_b_id set → "Có đề nghị mới" to
 *                          clan B admins (public-discovery flow only;
 *                          token-mode pendings have clan_b_id NULL
 *                          and are silently skipped — token URL is
 *                          shared out-of-band instead).
 *   - status='confirmed' → "Họ X đã xác nhận liên kết" to clan A admins
 *   - status='revoked'   → "Liên kết đã thu hồi" to admins of BOTH sides
 *
 * Security model identical to notify-contribution: a third party who
 * calls this can re-trigger an email matching the existing state, but
 * nothing else (no rows echoed, no state mutated). Acceptable for now.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Gia phả <noreply@giapha.local>";
const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "http://localhost:5173";

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

function emailLayout(opts: {
  clanName: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaHref
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

function buildPendingEmail(opts: {
  recipientClanName: string;
  peerClanName: string;
  peerPersonName: string;
  localPersonName: string;
  note: string | null;
  link: string;
}): { subject: string; html: string } {
  const subject = `[Gia phả ${opts.recipientClanName}] ${opts.peerClanName} đề nghị liên kết thông gia`;
  const noteBlock = opts.note
    ? `<div style="border-left:4px solid #B8862A;background:#FBF7F0;padding:10px 14px;margin:14px 0;">
         <p style="font-size:11px;color:#6F665F;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">
           Ghi chú từ bên đề nghị
         </p>
         <p style="margin:0;font-size:14px;">${esc(opts.note)}</p>
       </div>`
    : "";
  const body = `
    <p>Một dòng họ vừa gửi đề nghị liên kết thông gia tới bạn.</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Từ dòng họ</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.peerClanName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Người bên họ</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.peerPersonName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Nối với</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.localPersonName)} (bên bạn)</td></tr>
    </table>
    ${noteBlock}
    <p style="color:#6F665F;font-size:13px;">
      Mở /inlaws → tab "Đang chờ" để xác nhận hoặc từ chối.
    </p>`;
  return {
    subject,
    html: emailLayout({
      clanName: opts.recipientClanName,
      title: "Có đề nghị liên kết mới",
      body,
      ctaLabel: "Xem & quyết định",
      ctaHref: opts.link,
    }),
  };
}

function buildConfirmedEmail(opts: {
  recipientClanName: string;
  peerClanName: string;
  localPersonName: string;
  peerPersonName: string;
  link: string;
}): { subject: string; html: string } {
  const subject = `[Gia phả ${opts.recipientClanName}] ${opts.peerClanName} đã xác nhận liên kết thông gia`;
  const body = `
    <p>Đề xuất liên kết của bạn với <strong>${esc(opts.peerClanName)}</strong>
       vừa được admin bên đó xác nhận.</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Người bên bạn</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.localPersonName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6F665F;">Người bên kia</td>
          <td style="padding:4px 0;font-weight:600;">${esc(opts.peerPersonName)} (${esc(opts.peerClanName)})</td></tr>
    </table>
    <p style="color:#6F665F;font-size:13px;">
      Trang chi tiết người bên bạn giờ có thẻ "Liên kết thông gia" để xem 2 chiều.
    </p>`;
  return {
    subject,
    html: emailLayout({
      clanName: opts.recipientClanName,
      title: "Đã xác nhận liên kết",
      body,
      ctaLabel: "Xem danh sách liên kết",
      ctaHref: opts.link,
    }),
  };
}

function buildRevokedEmail(opts: {
  recipientClanName: string;
  peerClanName: string;
  link: string;
}): { subject: string; html: string } {
  const subject = `[Gia phả ${opts.recipientClanName}] Liên kết với ${opts.peerClanName} đã thu hồi`;
  const body = `
    <p>Liên kết thông gia giữa <strong>${esc(opts.recipientClanName)}</strong>
       và <strong>${esc(opts.peerClanName)}</strong> đã được thu hồi.</p>
    <p style="color:#6F665F;font-size:13px;">
      Dữ liệu gia phả của mỗi bên không đổi. Có thể đề nghị nối lại
      bất cứ lúc nào nếu thông tin cập nhật.
    </p>`;
  return {
    subject,
    html: emailLayout({
      clanName: opts.recipientClanName,
      title: "Liên kết đã thu hồi",
      body,
      ctaLabel: "Xem danh sách liên kết",
      ctaHref: opts.link,
    }),
  };
}

interface OutEmail {
  to: string;
  subject: string;
  html: string;
}

async function sendOne(email: OutEmail): Promise<{ ok: boolean; error?: string }> {
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

async function adminEmailsForClan(
  sb: ReturnType<typeof createClient>,
  clanId: string,
): Promise<string[]> {
  const { data: admins } = await sb
    .from("clan_members")
    .select("user_id")
    .eq("clan_id", clanId)
    .eq("role", "admin");
  const ids = (admins ?? []).map((a: { user_id: string }) => a.user_id);
  const emails: string[] = [];
  for (const id of ids) {
    const { data: u } = await sb.auth.admin.getUserById(id);
    if (u?.user?.email) emails.push(u.user.email);
  }
  return emails;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")
    return json({ error: "Method not allowed" }, { status: 405 });

  let body: { link_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.link_id) {
    return json({ error: "link_id required" }, { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: l, error: lErr } = await sb
    .from("person_links")
    .select(
      "id, status, clan_a_id, clan_b_id, person_a_id, person_b_id, note",
    )
    .eq("id", body.link_id)
    .maybeSingle();
  if (lErr) return json({ error: lErr.message }, { status: 500 });
  if (!l) return json({ error: "Not found" }, { status: 404 });

  // Fetch both clan + person names in parallel — needed across branches.
  const [{ data: cA }, { data: cB }, { data: pA }, { data: pB }] =
    await Promise.all([
      sb.from("clans").select("name").eq("id", l.clan_a_id).maybeSingle(),
      l.clan_b_id
        ? sb.from("clans").select("name").eq("id", l.clan_b_id).maybeSingle()
        : Promise.resolve({ data: null }),
      sb
        .from("persons")
        .select("full_name")
        .eq("id", l.person_a_id)
        .maybeSingle(),
      l.person_b_id
        ? sb
            .from("persons")
            .select("full_name")
            .eq("id", l.person_b_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const clanAName = (cA?.name as string) ?? "Gia phả";
  const clanBName = (cB?.name as string) ?? "Gia phả";
  const personAName = (pA?.full_name as string) ?? "—";
  const personBName = (pB?.full_name as string) ?? "—";

  const sent: Array<{ to: string; ok: boolean; error?: string }> = [];

  if (l.status === "pending") {
    // Public-discovery only — token-mode pendings have clan_b_id null
    // and the URL is shared out-of-band.
    if (!l.clan_b_id) {
      return json({ ok: true, skipped: "pending-token-mode" });
    }
    const bEmails = await adminEmailsForClan(sb, l.clan_b_id);
    if (bEmails.length === 0) {
      return json({ ok: true, skipped: "no-admin-emails-b" });
    }
    const tpl = buildPendingEmail({
      recipientClanName: clanBName,
      peerClanName: clanAName,
      peerPersonName: personAName,
      localPersonName: personBName,
      note: l.note ?? null,
      link: `${APP_BASE_URL}/clans/${l.clan_b_id}/inlaws`,
    });
    for (const to of bEmails) {
      const r = await sendOne({ to, subject: tpl.subject, html: tpl.html });
      sent.push({ to, ...r });
    }
  } else if (l.status === "confirmed") {
    // Email clan A admins — they proposed and have been waiting.
    const aEmails = await adminEmailsForClan(sb, l.clan_a_id);
    if (aEmails.length === 0) {
      return json({ ok: true, skipped: "no-admin-emails-a" });
    }
    const tpl = buildConfirmedEmail({
      recipientClanName: clanAName,
      peerClanName: clanBName,
      localPersonName: personAName,
      peerPersonName: personBName,
      link: `${APP_BASE_URL}/clans/${l.clan_a_id}/inlaws`,
    });
    for (const to of aEmails) {
      const r = await sendOne({ to, subject: tpl.subject, html: tpl.html });
      sent.push({ to, ...r });
    }
  } else if (l.status === "revoked") {
    // Email admins of BOTH sides — schema doesn't track who revoked,
    // so we err on the side of transparency over avoiding duplicates.
    // (The revoker also gets the email, useful as confirmation.)
    const [aEmails, bEmails] = await Promise.all([
      adminEmailsForClan(sb, l.clan_a_id),
      l.clan_b_id ? adminEmailsForClan(sb, l.clan_b_id) : Promise.resolve([]),
    ]);
    for (const to of aEmails) {
      const tpl = buildRevokedEmail({
        recipientClanName: clanAName,
        peerClanName: clanBName,
        link: `${APP_BASE_URL}/clans/${l.clan_a_id}/inlaws`,
      });
      const r = await sendOne({ to, subject: tpl.subject, html: tpl.html });
      sent.push({ to, ...r });
    }
    for (const to of bEmails) {
      const tpl = buildRevokedEmail({
        recipientClanName: clanBName,
        peerClanName: clanAName,
        link: `${APP_BASE_URL}/clans/${l.clan_b_id}/inlaws`,
      });
      const r = await sendOne({ to, subject: tpl.subject, html: tpl.html });
      sent.push({ to, ...r });
    }
    if (sent.length === 0) {
      return json({ ok: true, skipped: "no-admin-emails" });
    }
  } else {
    return json({ ok: true, skipped: `unknown-status:${l.status}` });
  }

  return json({ ok: true, sent });
});
