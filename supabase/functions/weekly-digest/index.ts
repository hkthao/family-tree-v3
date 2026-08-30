/**
 * weekly-digest: "Bản tin tuần" — gộp 1 tin/tuần cho mỗi người dùng để
 * kéo họ quay lại, kể cả tuần không trúng mốc nhắc sự kiện nào.
 *
 * Với mỗi profile bật `notify_weekly_digest` (mặc định true) và không bị
 * khoá: gom trong các dòng họ họ tham gia —
 *   1. Sự kiện 7 ngày tới: sinh nhật (người sống), giỗ (âm lịch), sự
 *      kiện tuỳ chỉnh / tảo mộ.
 *   2. Người mới thêm vào cây (7 ngày qua).
 *   3. Thông báo nền tảng mới (7 ngày qua).
 * Không có gì trong cả 3 mục → BỎ QUA (khỏi gửi tin rỗng).
 *
 * Gửi email (SMTP, dùng chung cấu hình GoTrue) + web-push (nếu user bật
 * notify_via_push và có đăng ký). Idempotent qua notification_log với
 * event_key `weekly_digest:<ngày chạy>` (cron tuần 1 lần → key duy nhất
 * mỗi tuần).
 *
 * Trigger: host cron hằng tuần POST kèm X-Cron-Token (như notify-events).
 * Body {"date":"yyyy-mm-dd"} để replay.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getSolarDate } from "npm:@dqcai/vn-lunar@1.0.1";
import webpush from "npm:web-push@3.6.7";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { encodeSubject } from "../_shared/mail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://giapha.thaohk.com";

// SMTP (dùng chung với GoTrue). Thiếu host/pass ⇒ dry-run (không gửi mail).
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const MAIL_FROM =
  Deno.env.get("SMTP_FROM") ??
  (Deno.env.get("SMTP_SENDER_NAME") && Deno.env.get("SMTP_ADMIN_EMAIL")
    ? `${Deno.env.get("SMTP_SENDER_NAME")} <${Deno.env.get("SMTP_ADMIN_EMAIL")}>`
    : "Dòng Họ Việt <noreply@giapha.local>");

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@giapha.local";
const PUSH_READY = !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
if (PUSH_READY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const LOOKAHEAD = 7;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

// ─── Helpers ngày (copy từ notify-events cho Edge runtime) ─────────

function daysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso + "T00:00:00Z").getTime();
  const t = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((t - f) / 86_400_000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function nextOccurrenceOfMonthDay(
  month: number,
  day: number,
  today: Date,
): string | null {
  if (!month || !day) return null;
  let year = today.getUTCFullYear();
  const mk = (y: number) => new Date(Date.UTC(y, month - 1, day));
  let cand = mk(year);
  if (cand.getUTCMonth() !== month - 1 || cand.getUTCDate() !== day) return null;
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (cand < todayUtc) {
    year++;
    cand = mk(year);
    if (cand.getUTCMonth() !== month - 1 || cand.getUTCDate() !== day) return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lunarAnniversaryInSolarYear(
  month: number,
  day: number,
  isLeap: boolean,
  solarYear: number,
): string | null {
  for (const y of [solarYear - 1, solarYear, solarYear + 1]) {
    const sol = getSolarDate(day, month, y, isLeap);
    if (sol && sol.year === solarYear) {
      return `${solarYear}-${pad(sol.month)}-${pad(sol.day)}`;
    }
  }
  return null;
}

// ─── SMTP ──────────────────────────────────────────────────────────

async function sendMail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!SMTP_HOST || !SMTP_PASS) return { ok: false, error: "no-smtp (dry-run)" };
  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      auth: { username: SMTP_USER, password: SMTP_PASS },
    },
  });
  try {
    // Mã hoá sẵn tiêu đề: denomailer nhét cả tiêu đề tiếng Việt vào một
    // encoded-word quá dài, Gmail bỏ cuộc và in ra chuỗi thô. Xem
    // _shared/mail.ts.
    await client.send({
      from: MAIL_FROM,
      to,
      subject: encodeSubject(subject),
      html,
      content: "auto",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `smtp: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    try {
      await client.close();
    } catch {
      /* bỏ qua */
    }
  }
}

// ─── Kiểu dữ liệu ──────────────────────────────────────────────────

interface UpcomingItem {
  kind: "birthday" | "anniversary" | "custom" | "tomb_visit";
  title: string;
  date: string;
  days: number;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function whenLabel(days: number): string {
  return days === 0 ? "Hôm nay" : days === 1 ? "Ngày mai" : `Còn ${days} ngày`;
}

function kindEmoji(kind: UpcomingItem["kind"]): string {
  return kind === "birthday"
    ? "🎂"
    : kind === "anniversary"
      ? "🕯️"
      : kind === "tomb_visit"
        ? "⛰️"
        : "📅";
}

// ─── Main ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (CRON_TOKEN && req.headers.get("X-Cron-Token") !== CRON_TOKEN) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let overrideDate: string | null = null;
  let dryRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.date === "string") overrideDate = body.date;
      // dryRun: tính toán đầy đủ nhưng KHÔNG gửi mail/push, KHÔNG ghi log —
      // dùng để xem trước số lượng mà không làm phiền người dùng thật.
      if (body?.dryRun === true) dryRun = true;
    } catch {
      /* body rỗng OK */
    }
  }
  const today = overrideDate ?? new Date().toISOString().slice(0, 10);
  const todayDate = new Date(today + "T00:00:00Z");
  const cutoffIso = new Date(
    todayDate.getTime() - LOOKAHEAD * 86_400_000,
  ).toISOString();
  const eventKey = `weekly_digest:${today}`;

  // 1) Người đã bật digest, chưa bị khoá.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, notify_via_push")
    .eq("notify_weekly_digest", true)
    .eq("is_suspended", false);
  if (profErr) return json({ error: profErr.message }, { status: 500 });
  const recipients = (profiles ?? []) as { id: string; notify_via_push: boolean }[];
  if (recipients.length === 0) {
    return json({ today, recipients: 0, sent: 0, failed: 0, skipped: 0 });
  }
  const recipientIds = recipients.map((p) => p.id);
  const pushEnabled = new Set(
    recipients.filter((p) => p.notify_via_push).map((p) => p.id),
  );

  // 2) Thành viên → clan của từng user + tập clan cần dữ liệu.
  const { data: memberRows } = await supabase
    .from("clan_members")
    .select("user_id, clan_id")
    .in("user_id", recipientIds);
  const clansByUser = new Map<string, string[]>();
  for (const m of (memberRows ?? []) as { user_id: string; clan_id: string }[]) {
    const a = clansByUser.get(m.user_id);
    if (a) a.push(m.clan_id);
    else clansByUser.set(m.user_id, [m.clan_id]);
  }
  const allClanIds = [
    ...new Set([...clansByUser.values()].flat()),
  ];
  if (allClanIds.length === 0) {
    return json({ today, recipients: recipients.length, sent: 0, failed: 0, skipped: recipients.length });
  }

  // 3) Dữ liệu các clan (song song).
  const [clansRes, personsRes, eventsRes, annRes, logRes, subsRes] =
    await Promise.all([
      supabase.from("clans").select("id, name").in("id", allClanIds),
      supabase
        .from("persons")
        .select(
          "id, clan_id, full_name, is_living, birth_date, created_at, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap",
        )
        .in("clan_id", allClanIds)
        .is("deleted_at", null),
      supabase
        .from("events")
        .select(
          "id, clan_id, title, event_type, date_solar, lunar_month, lunar_day, lunar_is_leap, lunar_year, is_yearly",
        )
        .in("clan_id", allClanIds),
      supabase
        .from("announcements")
        .select("id, title, published_at, created_at, is_public, expires_at")
        .eq("is_public", true)
        .gte("published_at", cutoffIso)
        .order("published_at", { ascending: false }),
      supabase
        .from("notification_log")
        .select("user_id, channel")
        .eq("event_key", eventKey),
      supabase
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth, failure_count")
        .in("user_id", [...pushEnabled]),
    ]);
  if (clansRes.error) return json({ error: clansRes.error.message }, { status: 500 });
  if (personsRes.error) return json({ error: personsRes.error.message }, { status: 500 });
  if (eventsRes.error) return json({ error: eventsRes.error.message }, { status: 500 });

  const clanName = new Map(
    (clansRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const persons = personsRes.data ?? [];
  const events = eventsRes.data ?? [];

  // Lọc thông báo còn hạn.
  const announcements = (annRes.data ?? []).filter(
    (a) => !a.expires_at || new Date(a.expires_at as string) > todayDate,
  ) as { id: string; title: string }[];

  // 4) Sự kiện 7 ngày tới, gom theo clan.
  const upcomingByClan = new Map<string, UpcomingItem[]>();
  const pushUp = (clanId: string, item: UpcomingItem) => {
    const a = upcomingByClan.get(clanId);
    if (a) a.push(item);
    else upcomingByClan.set(clanId, [item]);
  };

  for (const p of persons) {
    // Sinh nhật người còn sống.
    if (p.is_living && p.birth_date) {
      const [, m, d] = (p.birth_date as string).split("-").map(Number);
      const next = nextOccurrenceOfMonthDay(m, d, todayDate);
      if (next) {
        const days = daysBetween(today, next);
        if (days >= 0 && days <= LOOKAHEAD) {
          pushUp(p.clan_id as string, {
            kind: "birthday",
            title: `Sinh nhật ${p.full_name}`,
            date: next,
            days,
          });
        }
      }
    }
    // Giỗ (âm lịch) người đã mất.
    if (!p.is_living && p.death_anniv_lunar_month && p.death_anniv_lunar_day) {
      for (const yr of [todayDate.getUTCFullYear(), todayDate.getUTCFullYear() + 1]) {
        const iso = lunarAnniversaryInSolarYear(
          p.death_anniv_lunar_month as number,
          p.death_anniv_lunar_day as number,
          !!p.death_anniv_lunar_is_leap,
          yr,
        );
        if (!iso) continue;
        const days = daysBetween(today, iso);
        if (days < 0 || days > LOOKAHEAD) continue;
        pushUp(p.clan_id as string, {
          kind: "anniversary",
          title: `Giỗ ${p.full_name}`,
          date: iso,
          days,
        });
        break;
      }
    }
  }

  for (const ev of events) {
    const kind: UpcomingItem["kind"] =
      ev.event_type === "tomb_visit" ? "tomb_visit" : "custom";
    let iso: string | null = null;
    if (ev.date_solar) {
      iso = ev.is_yearly
        ? nextOccurrenceOfMonthDay(
            Number((ev.date_solar as string).slice(5, 7)),
            Number((ev.date_solar as string).slice(8, 10)),
            todayDate,
          )
        : (ev.date_solar as string);
    } else if (ev.lunar_month && ev.lunar_day) {
      const years = ev.is_yearly
        ? [todayDate.getUTCFullYear(), todayDate.getUTCFullYear() + 1]
        : ev.lunar_year
          ? [ev.lunar_year as number]
          : [];
      for (const yr of years) {
        const cand = lunarAnniversaryInSolarYear(
          ev.lunar_month as number,
          ev.lunar_day as number,
          !!ev.lunar_is_leap,
          yr,
        );
        if (cand && daysBetween(today, cand) >= 0) {
          iso = cand;
          break;
        }
      }
    }
    if (!iso) continue;
    const days = daysBetween(today, iso);
    if (days < 0 || days > LOOKAHEAD) continue;
    pushUp(ev.clan_id as string, {
      kind,
      title: ev.title as string,
      date: iso,
      days,
    });
  }

  // 5) Người mới thêm (7 ngày qua), gom theo clan.
  const newPersonsByClan = new Map<string, string[]>();
  for (const p of persons) {
    if ((p.created_at as string) >= cutoffIso) {
      const a = newPersonsByClan.get(p.clan_id as string);
      if (a) a.push(p.full_name as string);
      else newPersonsByClan.set(p.clan_id as string, [p.full_name as string]);
    }
  }

  // Đã gửi tuần này (dedupe).
  const sentEmail = new Set(
    ((logRes.data ?? []) as { user_id: string; channel: string }[])
      .filter((r) => r.channel === "email")
      .map((r) => r.user_id),
  );
  const sentPush = new Set(
    ((logRes.data ?? []) as { user_id: string; channel: string }[])
      .filter((r) => r.channel === "webpush")
      .map((r) => r.user_id),
  );

  const subsByUser = new Map<
    string,
    { id: string; endpoint: string; p256dh: string; auth: string; failure_count: number }[]
  >();
  for (const s of (subsRes.data ?? []) as {
    id: string; user_id: string; endpoint: string; p256dh: string; auth: string; failure_count: number;
  }[]) {
    const a = subsByUser.get(s.user_id);
    if (a) a.push(s);
    else subsByUser.set(s.user_id, [s]);
  }

  // 6) Gửi từng người.
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let pushSent = 0;
  const errors: string[] = [];

  for (const uid of recipientIds) {
    const clans = clansByUser.get(uid) ?? [];
    if (clans.length === 0) {
      skipped++;
      continue;
    }
    // Gom nội dung của các clan user tham gia.
    const up: Array<UpcomingItem & { clanId: string }> = [];
    let newCount = 0;
    for (const cid of clans) {
      for (const it of upcomingByClan.get(cid) ?? []) up.push({ ...it, clanId: cid });
      newCount += (newPersonsByClan.get(cid) ?? []).length;
    }
    up.sort((a, b) => a.days - b.days);

    const totalItems = up.length + newCount + announcements.length;
    if (totalItems === 0) {
      skipped++;
      continue; // tuần rỗng — không gửi
    }

    const sentinelClan = clans[0];

    // ── Email ──
    if (dryRun) {
      sent++; // "would send" — không gửi thật
    } else if (!sentEmail.has(uid)) {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      const to = u?.user?.email;
      if (to) {
        const html = digestHtml({ up, newCount, announcements, clanName });
        const subject = digestSubject(up, newCount, announcements.length);
        const r = await sendMail(to, subject, html);
        await supabase.from("notification_log").insert({
          user_id: uid,
          clan_id: sentinelClan,
          event_key: eventKey,
          channel: "email",
          status: r.ok ? "sent" : "failed",
          // Cùng câu chữ với email, để người dùng nhận ra đây là MỘT
          // việc chứ không phải bị nhắc hai lần.
          title: subject.replace(/^\[Dòng Họ Việt\]\s*/, ""),
          body: "Bản tin tuần của dòng họ bạn.",
          url: `/clans/${sentinelClan}`,
        });
        if (r.ok) sent++;
        else {
          failed++;
          if (r.error) errors.push(r.error);
        }
      } else {
        skipped++;
      }
    }

    // ── Push (nếu bật + có đăng ký) ──
    if (dryRun) {
      if (PUSH_READY && pushEnabled.has(uid) && (subsByUser.get(uid) ?? []).length > 0) {
        pushSent++; // "would push"
      }
    } else if (PUSH_READY && pushEnabled.has(uid) && !sentPush.has(uid)) {
      const subs = subsByUser.get(uid) ?? [];
      if (subs.length > 0) {
        const body = digestPushBody(up, newCount, announcements.length);
        let anyOk = false;
        for (const s of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({
                title: "Bản tin tuần — Dòng Họ Việt",
                body,
                url: `${APP_BASE_URL}/`,
                tag: eventKey,
              }),
              { TTL: 3 * 24 * 60 * 60 },
            );
            anyOk = true;
          } catch (e) {
            const err = e as { statusCode?: number };
            if (err.statusCode === 404 || err.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", s.id);
            }
          }
        }
        if (anyOk) {
          pushSent++;
          await supabase.from("notification_log").insert({
            user_id: uid,
            clan_id: sentinelClan,
            event_key: eventKey,
            channel: "webpush",
            status: "sent",
          });
        }
      }
    }
  }

  return json({
    today,
    dryRunRequested: dryRun,
    recipients: recipients.length,
    sent,
    pushSent,
    failed,
    skipped,
    errors: errors.slice(0, 5),
    smtpDryRun: !SMTP_PASS,
    pushReady: PUSH_READY,
  });
});

// ─── Render ────────────────────────────────────────────────────────

function digestSubject(
  up: Array<UpcomingItem & { clanId: string }>,
  newCount: number,
  annCount: number,
): string {
  const bits: string[] = [];
  if (up.length) bits.push(`${up.length} sự kiện sắp tới`);
  if (newCount) bits.push(`${newCount} người mới`);
  if (annCount) bits.push(`${annCount} thông báo`);
  return `[Dòng Họ Việt] Bản tin tuần — ${bits.join(" · ")}`;
}

function digestPushBody(
  up: Array<UpcomingItem & { clanId: string }>,
  newCount: number,
  annCount: number,
): string {
  const bits: string[] = [];
  if (up.length) bits.push(`${up.length} sự kiện sắp tới`);
  if (newCount) bits.push(`${newCount} người mới`);
  if (annCount) bits.push(`${annCount} thông báo mới`);
  return bits.join(" · ") || "Có cập nhật mới trong dòng họ.";
}

function digestHtml(opts: {
  up: Array<UpcomingItem & { clanId: string }>;
  newCount: number;
  announcements: { id: string; title: string }[];
  clanName: Map<string, string>;
}): string {
  const { up, newCount, announcements, clanName } = opts;

  const upRows = up
    .map((it) => {
      const cn = clanName.get(it.clanId) ?? "";
      return `<tr>
        <td style="padding:6px 0;font-size:15px;">${kindEmoji(it.kind)} ${esc(it.title)}${
          cn ? ` <span style="color:#6F665F;">· ${esc(cn)}</span>` : ""
        }</td>
        <td style="padding:6px 0;font-size:13px;color:#7A2230;text-align:right;white-space:nowrap;">${whenLabel(
          it.days,
        )}</td>
      </tr>`;
    })
    .join("");

  const annRows = announcements
    .map(
      (a) =>
        `<li style="margin:4px 0;font-size:14px;">📢 ${esc(a.title)}</li>`,
    )
    .join("");

  const upSection = up.length
    ? `<h2 style="font-size:16px;color:#1F1A17;margin:20px 0 6px;">Sự kiện 7 ngày tới</h2>
       <table style="width:100%;border-collapse:collapse;">${upRows}</table>`
    : "";
  const newSection = newCount
    ? `<p style="font-size:14px;margin:16px 0 0;">👥 <b>${newCount}</b> người vừa được thêm vào cây tuần này.</p>`
    : "";
  const annSection = announcements.length
    ? `<h2 style="font-size:16px;color:#1F1A17;margin:20px 0 6px;">Thông báo mới</h2>
       <ul style="margin:0;padding-left:18px;">${annRows}</ul>`
    : "";

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#FBF7F0;padding:24px;color:#1F1A17;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #D8CFC2;border-radius:8px;padding:24px;">
    <img src="https://giapha.thaohk.com/icons/app-icon-192.png" alt="Dòng Họ Việt" width="48" height="48" style="display:block;margin:0 0 10px;border-radius:10px;" />
    <p style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6F665F;margin:0 0 4px;">Dòng Họ Việt</p>
    <h1 style="font-size:22px;color:#7A2230;margin:0 0 4px;">Bản tin tuần</h1>
    <p style="font-size:13px;color:#6F665F;margin:0;">Tóm tắt những gì sắp diễn ra và mới cập nhật trong dòng họ của bạn.</p>
    ${upSection}
    ${newSection}
    ${annSection}
    <div style="margin:24px 0 0;">
      <a href="${APP_BASE_URL}/clans" style="display:inline-block;background:#7A2230;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Mở gia phả</a>
    </div>
    <hr style="border:none;border-top:1px solid #D8CFC2;margin:24px 0 8px;" />
    <p style="font-size:11px;color:#6F665F;margin:0;">Bạn nhận bản tin tuần vì đang bật thông báo. Tắt trong trang Tài khoản của app.</p>
  </div>
</body></html>`;
}
