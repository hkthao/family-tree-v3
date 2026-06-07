/**
 * iCalendar (.ics) export for clan birthdays / giỗ / custom events.
 *
 * Output imports cleanly into Google Calendar (via Settings → Add
 * calendar → Import) and Apple Calendar (double-click .ics file).
 * Once imported, events fire native reminders on the user's device
 * without our notify-events cron needing to do anything.
 *
 * Recurrence strategy:
 *   - Solar dates (living person birthdays, custom events with
 *     date_solar set) → single VEVENT with `RRULE:FREQ=YEARLY`.
 *     Calendar app recurs natively.
 *   - Lunar dates (giỗ, custom events with lunar_month/day) → we
 *     can't use RRULE because lunar dates drift on Gregorian. Instead
 *     emit a single VEVENT pinned to the next-occurrence solar date,
 *     plus RDATE entries listing the solar dates for the next N
 *     years. User re-imports once a decade if needed.
 *
 * Schema sources:
 *   persons.birth_date (living) → solar yearly
 *   persons.death_anniv_lunar_month/day (deceased) → lunar yearly
 *   events.date_solar (one-off) → single VEVENT
 *   events.date_solar + is_yearly → solar yearly
 *   events.lunar_month/day + is_yearly → lunar yearly multi-RDATE
 */

import { lunarAnniversaryInSolarYear } from "@/lib/lunarDate";

export interface IcsPerson {
  id: string;
  full_name: string;
  generation: number | null;
  is_living: boolean;
  birth_date: string | null; // yyyy-mm-dd
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
  death_anniv_lunar_is_leap?: boolean;
}

export interface IcsCustomEvent {
  id: string;
  title: string;
  date_solar: string | null; // yyyy-mm-dd
  lunar_month: number | null;
  lunar_day: number | null;
  lunar_is_leap?: boolean;
  is_yearly: boolean;
  related_person_id?: string | null;
}

export interface BuildIcsOptions {
  clanName: string;
  clanId: string;
  appBaseUrl: string;
  persons: IcsPerson[];
  customEvents?: IcsCustomEvent[];
  /** How many years of lunar→solar mappings to bake in. Default 10. */
  yearsAhead?: number;
  /** Seed for VEVENT UIDs + DTSTAMP. Provide for deterministic tests. */
  now?: Date;
}

const ICS_HEADER = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Gia phả//VN//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
];

const ICS_FOOTER = ["END:VCALENDAR"];

/** RFC 5545 §3.3.11 text escape — backslash, semicolon, comma, newline. */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function isoToYmd(iso: string): string | null {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return null;
  return `${y.padStart(4, "0")}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
}

/** Fold lines at 75 octets per RFC 5545 §3.1 (split with CRLF + leading space). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    out.push((i === 0 ? "" : " ") + chunk);
    i += chunk.length;
  }
  return out.join("\r\n");
}

interface IcsEvent {
  uid: string;
  dtstamp: string;
  summary: string;
  description?: string;
  /** Initial occurrence date (YYYYMMDD). */
  dtstart: string;
  /** Yearly solar recurrence — adds RRULE:FREQ=YEARLY. */
  yearly?: boolean;
  /** Additional explicit dates (lunar conversions across years). */
  rdates?: string[];
}

function emitEvent(e: IcsEvent): string[] {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${e.dtstamp}`,
    `SUMMARY:${esc(e.summary)}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  lines.push(`DTSTART;VALUE=DATE:${e.dtstart}`);
  if (e.yearly) lines.push("RRULE:FREQ=YEARLY");
  if (e.rdates && e.rdates.length > 0) {
    lines.push(`RDATE;VALUE=DATE:${e.rdates.join(",")}`);
  }
  lines.push("END:VEVENT");
  return lines.map(fold);
}

function dtstampNow(d: Date): string {
  // 20260607T103045Z — UTC, no separators per RFC 5545.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${mm}${s}Z`;
}

export function buildClanIcs(opts: BuildIcsOptions): string {
  const now = opts.now ?? new Date();
  const dtstamp = dtstampNow(now);
  const yearsAhead = opts.yearsAhead ?? 10;
  const thisYear = now.getUTCFullYear();
  const personLink = (id: string) =>
    `${opts.appBaseUrl}/clans/${opts.clanId}/people/${id}`;

  const events: IcsEvent[] = [];

  for (const p of opts.persons) {
    // Living person birthday: solar yearly. Need a full-precision
    // birth_date (some persons have year-only).
    if (p.is_living && p.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(p.birth_date)) {
      const ymd0 = isoToYmd(p.birth_date);
      if (ymd0) {
        events.push({
          uid: `birthday-${p.id}@giapha`,
          dtstamp,
          summary: `Sinh nhật ${p.full_name}`,
          description: `Mở trang: ${personLink(p.id)}`,
          dtstart: ymd0,
          yearly: true,
        });
      }
    }

    // Deceased person giỗ: lunar yearly. Compute next yearsAhead
    // solar occurrences, anchor on the soonest.
    if (
      !p.is_living &&
      p.death_anniv_lunar_month &&
      p.death_anniv_lunar_day
    ) {
      const solarDates: string[] = [];
      for (let y = thisYear; y < thisYear + yearsAhead; y++) {
        const solar = lunarAnniversaryInSolarYear(
          {
            month: p.death_anniv_lunar_month,
            day: p.death_anniv_lunar_day,
            isLeap: !!p.death_anniv_lunar_is_leap,
          },
          y,
        );
        if (solar) {
          const m = isoToYmd(solar);
          if (m) solarDates.push(m);
        }
      }
      if (solarDates.length > 0) {
        const gen = p.generation ? ` (Đời ${p.generation})` : "";
        events.push({
          uid: `gio-${p.id}@giapha`,
          dtstamp,
          summary: `Giỗ ${p.full_name}${gen}`,
          description: `Mở trang: ${personLink(p.id)}`,
          dtstart: solarDates[0],
          rdates: solarDates.slice(1),
        });
      }
    }
  }

  for (const e of opts.customEvents ?? []) {
    // Solar custom event
    if (e.date_solar) {
      const ymd0 = isoToYmd(e.date_solar);
      if (ymd0) {
        events.push({
          uid: `event-${e.id}@giapha`,
          dtstamp,
          summary: e.title,
          dtstart: ymd0,
          yearly: e.is_yearly,
        });
      }
      continue;
    }
    // Lunar custom event
    if (e.lunar_month && e.lunar_day) {
      const solarDates: string[] = [];
      for (let y = thisYear; y < thisYear + yearsAhead; y++) {
        const solar = lunarAnniversaryInSolarYear(
          {
            month: e.lunar_month,
            day: e.lunar_day,
            isLeap: !!e.lunar_is_leap,
          },
          y,
        );
        if (solar) {
          const m = isoToYmd(solar);
          if (m) solarDates.push(m);
        }
        if (!e.is_yearly) break; // one occurrence only
      }
      if (solarDates.length > 0) {
        events.push({
          uid: `event-${e.id}@giapha`,
          dtstamp,
          summary: e.title,
          dtstart: solarDates[0],
          rdates: solarDates.slice(1),
        });
      }
    }
  }

  const calName = `Gia phả ${opts.clanName}`;
  const headerLines = [
    ...ICS_HEADER,
    `X-WR-CALNAME:${esc(calName)}`,
    `X-WR-TIMEZONE:Asia/Ho_Chi_Minh`,
  ];

  // CRLF per RFC 5545; many parsers tolerate LF but Outlook is strict.
  return (
    [...headerLines, ...events.flatMap(emitEvent), ...ICS_FOOTER].join("\r\n") +
    "\r\n"
  );
}

/** Build the .ics + trigger a browser download. */
export function downloadClanIcs(opts: BuildIcsOptions): {
  filename: string;
  bytes: number;
} {
  const ics = buildClanIcs(opts);
  const safe = opts.clanName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `gia-pha_${safe}.ics`;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { filename, bytes: blob.size };
}
