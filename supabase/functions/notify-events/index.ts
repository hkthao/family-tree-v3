/**
 * notify-events: scheduled cron that sends event reminders.
 *
 * For every enabled row in `event_subscriptions`, computes the upcoming
 * events (birthdays + ngày giỗ + custom events) in each subscription's
 * lookahead window. When today's date matches `event_date - lead_day`,
 * dispatches an email via Resend and writes a `notification_log` row
 * for idempotency (the partial unique index on
 * (user_id, event_key, channel) guarantees we never resend).
 *
 * Triggering:
 *   - Production: pg_cron schedules a daily HTTP call to this endpoint
 *     (see migration 2026MMDDHHMMSS_notify_cron.sql). Authentication
 *     is the X-Cron-Token header.
 *   - Manual / staging: POST with the same header + optional
 *     {"date": "yyyy-mm-dd"} body to simulate a different day.
 *   - Dry-run: omit RESEND_API_KEY; the function still walks the data
 *     and writes "dry-run" rows to notification_log so you can verify
 *     the matcher without sending real emails.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getLunarDate, getSolarDate } from "npm:@dqcai/vn-lunar@1.0.1";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Gia phả <noreply@giapha.local>";
const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "https://giapha.app";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@giapha.local";

// Configure web-push once if VAPID env is set — when missing (dry-run /
// local dev without push), all push dispatch becomes a no-op.
const PUSH_READY = !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
if (PUSH_READY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
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

// ─── Shared matcher inlined (Edge runtime can't import from src/) ──

type SubChannel = "email" | "sms";
type SubEventType = "birthday" | "death_anniversary" | "custom";
type UpcomingKind = "birthday" | "anniversary" | "custom";

interface SubscriptionLite {
  id: string;
  user_id: string;
  clan_id: string;
  scope: "clan" | "branch" | "person";
  target_id: string | null;
  event_types: SubEventType[];
  channels: SubChannel[];
  lead_days: number[];
  is_enabled: boolean;
}

interface UpcomingEvent {
  key: string;
  kind: UpcomingKind;
  title: string;
  date: string;
  personId?: string;
  branchId?: string | null;
}

interface FireItem {
  subscriptionId: string;
  userId: string;
  clanId: string;
  channel: SubChannel;
  kind: UpcomingKind;
  title: string;
  eventDate: string;
  leadDays: number;
  eventKey: string;
  personId?: string;
}

const KIND_TO_EVENT_TYPE: Record<UpcomingKind, SubEventType> = {
  birthday: "birthday",
  anniversary: "death_anniversary",
  custom: "custom",
};

function daysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso + "T00:00:00Z").getTime();
  const t = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((t - f) / 86_400_000);
}

function computeFireList(
  today: string,
  subscriptions: SubscriptionLite[],
  events: UpcomingEvent[],
  alreadySent: Set<string>,
): FireItem[] {
  const out: FireItem[] = [];
  for (const sub of subscriptions) {
    if (!sub.is_enabled) continue;
    if (sub.channels.length === 0 || sub.lead_days.length === 0) continue;

    for (const evt of events) {
      if (sub.scope === "clan") {
        if (sub.target_id !== null) continue;
      } else if (sub.scope === "person") {
        if (sub.target_id !== evt.personId) continue;
      } else if (sub.scope === "branch") {
        if (!evt.branchId || sub.target_id !== evt.branchId) continue;
      }

      const eventType = KIND_TO_EVENT_TYPE[evt.kind];
      if (!sub.event_types.includes(eventType)) continue;

      const lead = daysBetween(today, evt.date);
      if (lead < 0) continue;
      if (!sub.lead_days.includes(lead)) continue;

      const sourceId =
        evt.personId ?? evt.key.split(":")[1] ?? evt.key;
      const eventKey = `${evt.kind}:${sourceId}:${evt.date}:lead${lead}`;

      for (const channel of sub.channels) {
        const dedup = `${sub.user_id}:${eventKey}:${channel}`;
        if (alreadySent.has(dedup)) continue;
        out.push({
          subscriptionId: sub.id,
          userId: sub.user_id,
          clanId: sub.clan_id,
          channel,
          kind: evt.kind,
          title: evt.title,
          eventDate: evt.date,
          leadDays: lead,
          eventKey,
          personId: evt.personId,
        });
        alreadySent.add(dedup);
      }
    }
  }
  return out;
}

// ─── Event computation (also inlined for Edge runtime) ─────────────

/**
 * Given a recurring lunar (month, day) and a target solar year, return
 * the ISO yyyy-mm-dd this anniversary falls on in that solar year.
 * Lunar new year happens late Jan / early Feb, so a single lunar
 * (month, day) can map to two adjacent solar calendar years — try
 * Y-1, Y, Y+1 and pick the result that lands in `solarYear`.
 */
function lunarAnniversaryInSolarYear(
  month: number,
  day: number,
  isLeap: boolean,
  solarYear: number,
): string | null {
  for (const y of [solarYear - 1, solarYear, solarYear + 1]) {
    const sol = getSolarDate(day, month, y, isLeap);
    if (sol && sol.year === solarYear) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${solarYear}-${pad(sol.month)}-${pad(sol.day)}`;
    }
  }
  return null;
}

function nextOccurrenceOfMonthDay(
  month: number,
  day: number,
  today: Date,
): string | null {
  if (!month || !day) return null;
  let year = today.getFullYear();
  const tryDate = (y: number) => new Date(y, month - 1, day);
  let cand = tryDate(year);
  if (cand.getMonth() !== month - 1 || cand.getDate() !== day) return null;
  if (cand < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    year++;
    cand = tryDate(year);
    if (cand.getMonth() !== month - 1 || cand.getDate() !== day) return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ─── Email rendering ───────────────────────────────────────────────

function emailSubject(item: FireItem): string {
  const when =
    item.leadDays === 0
      ? "Hôm nay"
      : item.leadDays === 1
        ? "Ngày mai"
        : `Còn ${item.leadDays} ngày`;
  return `[Gia phả] ${when}: ${item.title}`;
}

function emailHtml(item: FireItem, clanName: string): string {
  const kindLabel =
    item.kind === "birthday"
      ? "Sinh nhật"
      : item.kind === "anniversary"
        ? "Ngày giỗ"
        : "Sự kiện";
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, Segoe UI, sans-serif; background:#FBF7F0; padding:24px; color:#1F1A17;">
  <div style="max-width:520px; margin:0 auto; background:#FFFFFF; border:1px solid #D8CFC2; border-radius:8px; padding:24px;">
    <p style="color:#6F665F; font-size:12px; letter-spacing:2px; margin:0 0 8px;">GIA PHẢ ${esc(clanName)}</p>
    <h1 style="color:#7A2230; font-size:22px; margin:0 0 6px;">${esc(item.title)}</h1>
    <p style="color:#6F665F; margin:0 0 16px;">${esc(kindLabel)} · ${esc(item.eventDate)}</p>
    <p>Còn <strong>${item.leadDays} ngày</strong> nữa.</p>
    <p style="color:#6F665F; font-size:11px; margin-top:24px;">
      Bạn nhận email này vì đã theo dõi sự kiện của dòng họ trên Gia phả.
      Tắt thông báo trong trang Sự kiện → "Theo dõi sự kiện".
    </p>
  </div>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendEmailViaResend(
  to: string,
  item: FireItem,
  clanName: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "no-api-key (dry-run)" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: emailSubject(item),
      html: emailHtml(item, clanName),
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `resend ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

// ─── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (CRON_TOKEN && req.headers.get("X-Cron-Token") !== CRON_TOKEN) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Optional override date so operators can replay a specific day.
  let overrideDate: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.date === "string") overrideDate = body.date;
    } catch {
      /* empty body is fine */
    }
  }
  const today = overrideDate ?? new Date().toISOString().slice(0, 10);
  const todayDate = new Date(today + "T00:00:00Z");
  const lookaheadDays = 30;

  // 1) Pull every enabled subscription
  const { data: subs, error: subErr } = await supabase
    .from("event_subscriptions")
    .select(
      "id, user_id, clan_id, scope, target_id, event_types, channels, lead_days, is_enabled",
    )
    .eq("is_enabled", true);
  if (subErr) return json({ error: subErr.message }, { status: 500 });

  const subscriptions = (subs ?? []) as SubscriptionLite[];
  // Don't short-circuit when subscriptions is empty — the monthly-
  // lunar reminder runs from a separate per-user flag and needs to
  // fire even when nobody has any event_subscriptions configured.
  // The downstream computeFireList just returns [] in that case.

  // 2) Pull the relevant clans' data (persons + events + anniversaries)
  //    in one round-trip per clan referenced by the subs.
  const clanIds = [...new Set(subscriptions.map((s) => s.clan_id))];

  const [clansRes, personsRes, eventsRes, profilesRes] = await Promise.all([
    supabase.from("clans").select("id, name").in("id", clanIds),
    supabase
      .from("persons")
      .select(
        "id, clan_id, full_name, is_living, birth_date, branch_id, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap, generation",
      )
      .in("clan_id", clanIds)
      .is("deleted_at", null),
    supabase
      .from("events")
      .select(
        "id, clan_id, title, event_type, date_solar, lunar_year, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id",
      )
      .in("clan_id", clanIds),
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(subscriptions.map((s) => s.user_id))]),
  ]);
  if (clansRes.error) return json({ error: clansRes.error.message }, { status: 500 });
  if (personsRes.error) return json({ error: personsRes.error.message }, { status: 500 });
  if (eventsRes.error) return json({ error: eventsRes.error.message }, { status: 500 });
  if (profilesRes.error) return json({ error: profilesRes.error.message }, { status: 500 });

  // Fetch emails from auth.users (service role can read them)
  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const emails = new Map<string, string>();
  for (const id of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(id);
    if (u?.user?.email) emails.set(id, u.user.email);
  }

  const clanName = new Map(
    (clansRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const persons = personsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const personBranch = new Map<string, string | null>();
  for (const p of persons) personBranch.set(p.id as string, (p.branch_id as string | null) ?? null);

  // 3) Compute upcoming events per clan (we just need a flat list — the
  //    matcher's scope/target filter will drop irrelevant ones).
  const upcoming: UpcomingEvent[] = [];

  for (const p of persons) {
    // Birthdays (living persons only)
    if (p.is_living && p.birth_date) {
      const [, m, d] = p.birth_date.split("-").map(Number);
      const next = nextOccurrenceOfMonthDay(m, d, todayDate);
      if (next) {
        const days = daysBetween(today, next);
        if (days >= 0 && days <= lookaheadDays) {
          upcoming.push({
            key: `birthday:${p.id}:${next}`,
            kind: "birthday",
            title: `Sinh nhật ${p.full_name}`,
            date: next,
            personId: p.id,
            branchId: (p.branch_id as string | null) ?? null,
          });
        }
      }
    }
    // Ngày giỗ for deceased with lunar anniversary recorded. The lunar
    // (month, day) can fall in this or next calendar year depending on
    // when Tết lands; try both and keep the first match in the lookahead.
    if (
      !p.is_living &&
      p.death_anniv_lunar_month &&
      p.death_anniv_lunar_day
    ) {
      const candidateYears = [
        todayDate.getUTCFullYear(),
        todayDate.getUTCFullYear() + 1,
      ];
      for (const yr of candidateYears) {
        const iso = lunarAnniversaryInSolarYear(
          p.death_anniv_lunar_month,
          p.death_anniv_lunar_day,
          !!p.death_anniv_lunar_is_leap,
          yr,
        );
        if (!iso) continue;
        const days = daysBetween(today, iso);
        if (days < 0 || days > lookaheadDays) continue;
        upcoming.push({
          key: `anniversary:${p.id}:${iso}`,
          kind: "anniversary",
          title: `Giỗ ${p.full_name}`,
          date: iso,
          personId: p.id,
          branchId: (p.branch_id as string | null) ?? null,
        });
        break; // first matching solar year is enough
      }
    }
  }

  // Custom events from the events table
  for (const ev of events) {
    if (ev.date_solar) {
      const iso = ev.is_yearly
        ? nextOccurrenceOfMonthDay(
            Number(ev.date_solar.slice(5, 7)),
            Number(ev.date_solar.slice(8, 10)),
            todayDate,
          )
        : ev.date_solar;
      if (!iso) continue;
      const days = daysBetween(today, iso);
      if (days < 0 || days > lookaheadDays) continue;
      upcoming.push({
        key: `custom:${ev.id}:${iso}`,
        kind: "custom",
        title: ev.title,
        date: iso,
        personId: ev.related_person_id ?? undefined,
        branchId: ev.related_person_id
          ? (personBranch.get(ev.related_person_id as string) ?? null)
          : null,
      });
    }
  }

  // 4) Load existing notification_log rows so the matcher can dedupe.
  const { data: logRows, error: logErr } = await supabase
    .from("notification_log")
    .select("user_id, event_key, channel")
    .gte("sent_at", todayDate.toISOString());
  if (logErr) return json({ error: logErr.message }, { status: 500 });
  const alreadySent = new Set(
    (logRows ?? []).map(
      (r) => `${r.user_id}:${r.event_key}:${r.channel}`,
    ),
  );

  // 5) Match and dispatch.
  const fires = computeFireList(today, subscriptions, upcoming, alreadySent);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const f of fires) {
    const recipient = emails.get(f.userId);
    if (!recipient || f.channel !== "email") {
      // SMS not wired yet — record as skipped failure.
      await supabase.from("notification_log").insert({
        user_id: f.userId,
        clan_id: f.clanId,
        event_key: f.eventKey,
        channel: f.channel,
        status: "failed",
      });
      failed++;
      continue;
    }
    const result = await sendEmailViaResend(
      recipient,
      f,
      clanName.get(f.clanId) ?? "",
    );
    await supabase.from("notification_log").insert({
      user_id: f.userId,
      clan_id: f.clanId,
      event_key: f.eventKey,
      channel: f.channel,
      status: result.ok ? "sent" : "failed",
    });
    if (result.ok) {
      sent++;
    } else {
      failed++;
      if (result.error) errors.push(result.error);
    }
  }

  // ── Mùng 1 / Rằm reminders ──────────────────────────────────────
  // Independent of event_subscriptions: a per-user toggle on the
  // profiles row. Fires on lunar day 1 (mùng 1) and lunar day 15
  // (rằm) for every user who opted in. Reuses the notification_log
  // dedupe via a single event_key per date.
  const monthlyResult = await dispatchMonthlyLunar({
    supabase,
    today,
    todayDate,
    alreadySent,
  });
  sent += monthlyResult.sent;
  failed += monthlyResult.failed;
  for (const e of monthlyResult.errors) errors.push(e);

  // ── Web Push fan-out (rides along email fires) ───────────────────
  // For every email fire and the monthly-lunar event of the day, if
  // the user has notify_via_push enabled we also push to all their
  // browser subscriptions. Dedupe via notification_log channel='webpush'.
  const pushResult = await dispatchWebPush({
    supabase,
    fires,
    monthlyKey: monthlyResult.monthlyEventKey,
    monthlyOccasion: monthlyResult.monthlyOccasion,
    monthlyLunarMonth: monthlyResult.monthlyLunarMonth,
    alreadySent,
    clanName,
  });
  sent += pushResult.sent;
  failed += pushResult.failed;
  for (const e of pushResult.errors) errors.push(e);

  return json({
    today,
    processed: fires.length + monthlyResult.processed,
    sent,
    failed,
    pushSent: pushResult.sent,
    pushFailed: pushResult.failed,
    errors: errors.slice(0, 5),
    dryRun: !RESEND_API_KEY,
    pushReady: PUSH_READY,
  });
});

// ─── Mùng 1 / Rằm dispatch helper ─────────────────────────────────

async function dispatchMonthlyLunar(opts: {
  supabase: ReturnType<typeof createClient>;
  today: string;
  todayDate: Date;
  alreadySent: Set<string>;
}): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
  /** When non-null, today is mùng 1 or rằm — these expose the event
   *  metadata so the web-push dispatcher can fan out a parallel push. */
  monthlyEventKey: string | null;
  monthlyOccasion: string | null;
  monthlyLunarMonth: number | null;
}> {
  const { supabase, today, todayDate, alreadySent } = opts;
  // Compute today's lunar day to decide whether this is mùng 1 or rằm.
  const lunar = getLunarDate(
    todayDate.getUTCDate(),
    todayDate.getUTCMonth() + 1,
    todayDate.getUTCFullYear(),
  );
  const isMung1 = lunar.day === 1;
  const isRam = lunar.day === 15;
  if (!isMung1 && !isRam) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
      monthlyEventKey: null,
      monthlyOccasion: null,
      monthlyLunarMonth: null,
    };
  }
  const eventKey = `monthly_lunar:${today}`;
  const occasion = isMung1 ? "Mùng 1" : "Rằm";
  const lunarMonth = lunar.month;

  // Opted-in profiles. Skip suspended accounts.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("notify_monthly_lunar", true)
    .eq("is_suspended", false);
  if (profErr) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [profErr.message],
      monthlyEventKey: eventKey,
      monthlyOccasion: occasion,
      monthlyLunarMonth: lunarMonth,
    };
  }
  const recipientIds = (profiles ?? []).map(
    (p: { id: string }) => p.id,
  );
  if (recipientIds.length === 0) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
      monthlyEventKey: eventKey,
      monthlyOccasion: occasion,
      monthlyLunarMonth: lunarMonth,
    };
  }

  // Pick a sentinel clan_id per recipient — notification_log.clan_id
  // is NOT NULL, but this reminder isn't clan-specific. Use whichever
  // clan the user is a member of (any one will do).
  const { data: memberRows } = await supabase
    .from("clan_members")
    .select("user_id, clan_id")
    .in("user_id", recipientIds);
  const firstClanByUser = new Map<string, string>();
  for (const m of memberRows ?? []) {
    const r = m as { user_id: string; clan_id: string };
    if (!firstClanByUser.has(r.user_id)) {
      firstClanByUser.set(r.user_id, r.clan_id);
    }
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  let processed = 0;

  for (const uid of recipientIds) {
    const dedupeKey = `${uid}:${eventKey}:email`;
    if (alreadySent.has(dedupeKey)) continue;
    const clanId = firstClanByUser.get(uid);
    if (!clanId) continue; // orphan user with no clan membership
    processed++;

    // Resolve email via auth admin (same pattern as the main loop's
    // emails map — we deferred this lookup until we knew who's
    // actually eligible to keep the API calls bounded).
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    const to = u?.user?.email;
    if (!to) {
      await supabase.from("notification_log").insert({
        user_id: uid,
        clan_id: clanId,
        event_key: eventKey,
        channel: "email",
        status: "failed",
      });
      failed++;
      continue;
    }

    const subject = `[Gia phả] ${occasion} tháng ${lunarMonth} âm — Thắp hương`;
    const html = monthlyLunarHtml({ occasion, lunarMonth });
    const result = await sendMonthlyEmail(to, subject, html);
    await supabase.from("notification_log").insert({
      user_id: uid,
      clan_id: clanId,
      event_key: eventKey,
      channel: "email",
      status: result.ok ? "sent" : "failed",
    });
    if (result.ok) sent++;
    else {
      failed++;
      if (result.error) errors.push(result.error);
    }
  }
  return {
    processed,
    sent,
    failed,
    errors,
    monthlyEventKey: eventKey,
    monthlyOccasion: occasion,
    monthlyLunarMonth: lunarMonth,
  };
}

function monthlyLunarHtml(opts: {
  occasion: string;
  lunarMonth: number;
}): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1F1A17;background:#FBF7F0;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #D8CFC2;">
      <p style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6F665F;margin:0 0 4px;">Gia phả</p>
      <h1 style="font-size:22px;color:#7A2230;margin:0 0 14px;">Hôm nay là ${opts.occasion} tháng ${opts.lunarMonth} âm lịch</h1>
      <p style="font-size:15px;margin:0 0 12px;">Đừng quên thắp hương lên bàn thờ tổ tiên hôm nay.</p>
      <p style="font-size:13px;color:#6F665F;margin:14px 0 0;">
        Bạn có thể tắt nhắc này trong trang Tài khoản của app.
      </p>
      <hr style="border:none;border-top:1px solid #D8CFC2;margin:24px 0 8px;" />
      <p style="font-size:11px;color:#6F665F;margin:0;">Email tự động từ ứng dụng Gia phả.</p>
    </div></body></html>`;
}

async function sendMonthlyEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "no-api-key (dry-run)" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `resend ${res.status}: ${await res.text()}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `network: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── Web Push dispatch ─────────────────────────────────────────────
//
// Runs AFTER email dispatch. For every (userId, eventKey) that was just
// fired via email, plus the monthly-lunar event when active, also fan
// out a web push to each of the user's registered push_subscriptions —
// IF the user has flipped `notify_via_push` on.
//
// Concurrency: chunks of 50 via Promise.allSettled to keep wall-clock
// bounded for clans with hundreds of subscribers. Per-sub errors are
// captured and either delete the row (410/404 = gone) or bump
// failure_count (other errors).

interface PushFire {
  userId: string;
  eventKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

const PUSH_CHUNK = 50;
const FAILURE_THRESHOLD = 5;

async function dispatchWebPush(opts: {
  supabase: ReturnType<typeof createClient>;
  fires: FireItem[];
  monthlyKey: string | null;
  monthlyOccasion: string | null;
  monthlyLunarMonth: number | null;
  alreadySent: Set<string>;
  clanName: Map<string, string>;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const {
    supabase,
    fires,
    monthlyKey,
    monthlyOccasion,
    monthlyLunarMonth,
    alreadySent,
    clanName,
  } = opts;

  if (!PUSH_READY) {
    return { sent: 0, failed: 0, errors: [] };
  }

  // Collect candidate (userId, eventKey) pairs from email fires +
  // the monthly-lunar event.
  const candidates: PushFire[] = [];
  for (const f of fires) {
    if (f.channel !== "email") continue;
    candidates.push({
      userId: f.userId,
      eventKey: f.eventKey,
      title: buildPushTitle(f),
      body: buildPushBody(f, clanName.get(f.clanId) ?? ""),
      url: f.personId
        ? `${APP_BASE_URL}/clans/${f.clanId}/people/${f.personId}`
        : `${APP_BASE_URL}/clans/${f.clanId}/today`,
      tag: f.eventKey,
    });
  }

  if (monthlyKey && monthlyOccasion && monthlyLunarMonth) {
    const { data: monthlyProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("notify_monthly_lunar", true)
      .eq("is_suspended", false);
    for (const p of monthlyProfiles ?? []) {
      candidates.push({
        userId: (p as { id: string }).id,
        eventKey: monthlyKey,
        title: `${monthlyOccasion} tháng ${monthlyLunarMonth} âm`,
        body: "Đừng quên thắp hương lên bàn thờ tổ tiên hôm nay.",
        url: `${APP_BASE_URL}/`,
        tag: monthlyKey,
      });
    }
  }

  if (candidates.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  // Filter to users with notify_via_push = true.
  const userIds = [...new Set(candidates.map((c) => c.userId))];
  const { data: profileRows, error: profErr } = await supabase
    .from("profiles")
    .select("id, notify_via_push, is_suspended")
    .in("id", userIds);
  if (profErr) return { sent: 0, failed: 0, errors: [profErr.message] };

  const enabled = new Set<string>();
  for (const r of profileRows ?? []) {
    const row = r as {
      id: string;
      notify_via_push: boolean;
      is_suspended: boolean;
    };
    if (row.notify_via_push && !row.is_suspended) enabled.add(row.id);
  }

  // Dedupe vs notification_log (same Set used by email dispatch — channel
  // 'webpush' rows are already loaded from today's log range).
  const pending = candidates.filter((c) => {
    if (!enabled.has(c.userId)) return false;
    return !alreadySent.has(`${c.userId}:${c.eventKey}:webpush`);
  });

  if (pending.length === 0) return { sent: 0, failed: 0, errors: [] };

  // Load all subs for the targeted users in one query.
  const targetUserIds = [...new Set(pending.map((c) => c.userId))];
  const { data: subRows, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, failure_count")
    .in("user_id", targetUserIds);
  if (subErr) return { sent: 0, failed: 0, errors: [subErr.message] };

  const subsByUser = new Map<string, SubRow[]>();
  for (const s of (subRows ?? []) as SubRow[]) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Reserve notification_log rows up front (one per fire) to keep the
  // dispatcher idempotent across cron re-runs. ON CONFLICT DO NOTHING
  // makes the insert a no-op when the same (user, event, channel)
  // already landed earlier today.
  const reservations = pending.map((p) => ({
    user_id: p.userId,
    // Pick a sentinel clan_id later if it's a monthly_lunar event with
    // no person attached. For event fires we already have a clan_id
    // via the original FireItem — look it up.
    event_key: p.eventKey,
    channel: "webpush",
  }));

  // Fan out by-user so multi-device delivery uses the same payload.
  for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
    const chunk = pending.slice(i, i + PUSH_CHUNK);
    const tasks = chunk.flatMap((c) => {
      const subs = subsByUser.get(c.userId) ?? [];
      return subs.map((s) =>
        sendOnePush(s, c).then(
          async (result) => {
            if (result.ok) {
              await supabase
                .from("push_subscriptions")
                .update({
                  last_success_at: new Date().toISOString(),
                  failure_count: 0,
                })
                .eq("id", s.id);
              sent++;
            } else if (result.kind === "gone") {
              await supabase.from("push_subscriptions").delete().eq("id", s.id);
              failed++;
            } else {
              const nextCount = s.failure_count + 1;
              if (nextCount >= FAILURE_THRESHOLD) {
                await supabase.from("push_subscriptions").delete().eq("id", s.id);
              } else {
                await supabase
                  .from("push_subscriptions")
                  .update({ failure_count: nextCount })
                  .eq("id", s.id);
              }
              failed++;
              if (result.error) errors.push(result.error);
            }
          },
        ),
      );
    });
    await Promise.allSettled(tasks);
  }

  // After dispatch attempts (some subs may have been deleted), log
  // ONE notification_log row per (user, event, webpush) regardless of
  // multi-device fan-out — the dedupe key is per-user not per-sub.
  // Use service-role bulk insert with ON CONFLICT DO NOTHING via raw
  // .upsert() on the unique index.
  // We need a clan_id for the log row; for event fires take it from
  // FireItem, for monthly use the user's first clan.
  const fireClanByUserEvent = new Map<string, string>();
  for (const f of fires) {
    fireClanByUserEvent.set(`${f.userId}:${f.eventKey}`, f.clanId);
  }
  let firstClanByUser: Map<string, string> = new Map();
  if (monthlyKey) {
    const monthlyUsers = pending
      .filter((c) => c.eventKey === monthlyKey)
      .map((c) => c.userId);
    if (monthlyUsers.length > 0) {
      const { data: memberRows } = await supabase
        .from("clan_members")
        .select("user_id, clan_id")
        .in("user_id", monthlyUsers);
      for (const m of memberRows ?? []) {
        const r = m as { user_id: string; clan_id: string };
        if (!firstClanByUser.has(r.user_id)) {
          firstClanByUser.set(r.user_id, r.clan_id);
        }
      }
    }
  }

  for (const r of reservations) {
    const clanId =
      fireClanByUserEvent.get(`${r.user_id}:${r.event_key}`) ??
      firstClanByUser.get(r.user_id);
    if (!clanId) continue;
    await supabase.from("notification_log").upsert(
      {
        user_id: r.user_id,
        clan_id: clanId,
        event_key: r.event_key,
        channel: r.channel,
        status: "sent",
      },
      {
        onConflict: "user_id,event_key,channel",
        ignoreDuplicates: true,
      },
    );
  }

  return { sent, failed, errors };
}

function buildPushTitle(f: FireItem): string {
  const when =
    f.leadDays === 0 ? "Hôm nay" : f.leadDays === 1 ? "Ngày mai" : `${f.leadDays} ngày nữa`;
  return `${when}: ${f.title}`;
}

function buildPushBody(f: FireItem, clanName: string): string {
  const kind =
    f.kind === "birthday"
      ? "Sinh nhật"
      : f.kind === "anniversary"
        ? "Ngày giỗ"
        : "Sự kiện";
  return clanName ? `${kind} · ${clanName}` : kind;
}

type PushResult =
  | { ok: true }
  | { ok: false; kind: "gone" | "transient"; error?: string };

async function sendOnePush(sub: SubRow, fire: PushFire): Promise<PushResult> {
  try {
    const payload = JSON.stringify({
      title: fire.title,
      body: fire.body,
      url: fire.url,
      tag: fire.tag,
    });
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
      { TTL: 24 * 60 * 60 },
    );
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 404 || err.statusCode === 410) {
      return { ok: false, kind: "gone" };
    }
    return {
      ok: false,
      kind: "transient",
      error: `push ${err.statusCode ?? "?"}: ${err.message ?? String(e)}`,
    };
  }
}
