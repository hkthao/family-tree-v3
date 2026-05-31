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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSolarDate } from "https://esm.sh/@dqcai/vn-lunar@1.0.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Gia phả <noreply@giapha.local>";

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
      } else {
        continue; // branch scope not wired yet
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
  if (subscriptions.length === 0) {
    return json({ today, processed: 0, sent: 0, skipped: 0 });
  }

  // 2) Pull the relevant clans' data (persons + events + anniversaries)
  //    in one round-trip per clan referenced by the subs.
  const clanIds = [...new Set(subscriptions.map((s) => s.clan_id))];

  const [clansRes, personsRes, eventsRes, profilesRes] = await Promise.all([
    supabase.from("clans").select("id, name").in("id", clanIds),
    supabase
      .from("persons")
      .select(
        "id, clan_id, full_name, is_living, birth_date, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap, generation",
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

  return json({
    today,
    processed: fires.length,
    sent,
    failed,
    errors: errors.slice(0, 5),
    dryRun: !RESEND_API_KEY,
  });
});
