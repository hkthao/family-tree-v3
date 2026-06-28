import { lunarAnniversaryInSolarYear } from "@/lib/lunarDate";
import type { EventRow } from "@/lib/queries/events";
import type { PersonForTree } from "@/lib/queries/tree";

/**
 * Upcoming-event computation.
 *
 * Aggregates 3 sources into a single sorted list:
 *   - Birthdays — living persons with a known birth_date (day precision);
 *     repeats yearly, so we pick this calendar year's date (or next
 *     year's if already past).
 *   - Ngày giỗ — deceased persons with death_anniv_lunar_month/day;
 *     converted from lunar to solar for the current calendar year via
 *     the same library that powers PersonDetail's lunar rows.
 *   - Custom events from the `events` table — either solar or lunar,
 *     yearly or one-shot.
 *
 * Pure function: takes already-fetched lists and a "today" date, so
 * tests can run with deterministic input without mocking the clock.
 */

export type UpcomingKind = "birthday" | "anniversary" | "custom" | "tomb_visit";

export interface UpcomingEvent {
  /** Stable id for React keys + dedupe ("kind:source_id:yyyy-mm-dd"). */
  key: string;
  kind: UpcomingKind;
  title: string;
  /** Resting place id when the event is a tảo mộ / chạp họ tied to a mộ. */
  restingPlaceId?: string | null;
  /** Id của sự kiện trong bảng events (chỉ custom / tomb_visit) — để mở chi tiết. */
  eventId?: string;
  /** ISO yyyy-mm-dd this event lands on (in the local year). */
  date: string;
  /** Days from `today` until `date`. 0 = today. */
  daysUntil: number;
  /** Person id if the event belongs to one — for linking in the UI. */
  personId?: string;
  /**
   * Branch the event's person belongs to (when known). Used by the
   * notification matcher to honor scope="branch" subscriptions — without
   * it, branch-scope subs would silently no-op.
   */
  branchId?: string | null;
  /**
   * Dòng họ chứa sự kiện. Bắt buộc cho luồng notify (matcher phải khớp
   * clan_id của subscription để không gửi nhầm sự kiện của họ khác).
   * Optional vì các tính toán phía client luôn trong phạm vi 1 dòng họ.
   */
  clanId?: string;
  /** Optional secondary line, e.g. "tròn 50 tuổi" or "đời 2". */
  subtitle?: string;
}

interface ComputeInput {
  today: Date;
  /** How far ahead to look (inclusive). */
  daysAhead: number;
  persons: PersonForTree[];
  events: EventRow[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function diffDays(from: Date, toIso: string): number {
  const t = new Date(toIso + "T00:00:00");
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((t.getTime() - f.getTime()) / 86400_000);
}

/**
 * For a recurring (month, day) pair, pick the nearest solar date NOT
 * before `today`. Returns null if month/day are invalid (e.g. 31/4).
 */
function nextOccurrenceOfMonthDay(
  month: number,
  day: number,
  today: Date,
): string | null {
  if (!month || !day) return null;
  let year = today.getFullYear();
  const tryDate = (y: number) => new Date(y, month - 1, day);
  let candidate = tryDate(year);
  // Catch invalid combos (Feb 30 → JS normalises into March).
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    return null;
  }
  if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    year++;
    candidate = tryDate(year);
    if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
      return null;
    }
  }
  return isoOf(year, month, day);
}

export function computeUpcomingEvents({
  today,
  daysAhead,
  persons,
  events,
}: ComputeInput): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  const personBranch = new Map<string, string | null>();
  for (const p of persons) personBranch.set(p.id, p.branch_id ?? null);

  // ─── Birthdays (living, with full solar day precision) ─────────────
  for (const p of persons) {
    if (!p.is_living) continue;
    if (!p.birth_date) continue;
    const [y, m, d] = p.birth_date.split("-").map(Number);
    if (!Number.isInteger(m) || !Number.isInteger(d)) continue;
    const nextIso = nextOccurrenceOfMonthDay(m, d, today);
    if (!nextIso) continue;
    const days = diffDays(today, nextIso);
    if (days < 0 || days > daysAhead) continue;
    const age = Number.isInteger(y)
      ? Number(nextIso.slice(0, 4)) - y
      : null;
    out.push({
      key: `birthday:${p.id}:${nextIso}`,
      kind: "birthday",
      title: `Sinh nhật ${p.full_name}`,
      date: nextIso,
      daysUntil: days,
      personId: p.id,
      branchId: p.branch_id ?? null,
      subtitle: age !== null ? `tròn ${age} tuổi` : undefined,
    });
  }

  // ─── Ngày giỗ (deceased, lunar month/day) ──────────────────────────
  // PersonForTree doesn't currently carry the anniv lunar fields —
  // those live on the persons table. The caller fetches them.
  // For now, we accept a separate `anniversaries` array via the
  // wider PersonForCalendar shape — see below.

  // ─── Custom events ─────────────────────────────────────────────────
  for (const e of events) {
    // Solar event
    if (e.date_solar) {
      const [, m, d] = e.date_solar.split("-").map(Number);
      if (!Number.isInteger(m) || !Number.isInteger(d)) continue;
      let iso: string | null;
      if (e.is_yearly) {
        iso = nextOccurrenceOfMonthDay(m, d, today);
      } else {
        iso = e.date_solar;
      }
      if (!iso) continue;
      const days = diffDays(today, iso);
      if (days < 0 || days > daysAhead) continue;
      out.push({
        key: `${e.event_type === "tomb_visit" ? "tomb_visit" : "custom"}:${e.id}:${iso}`,
        kind: e.event_type === "tomb_visit" ? "tomb_visit" : "custom",
        title: e.title,
        date: iso,
        daysUntil: days,
        eventId: e.id,
        personId: e.related_person_id ?? undefined,
        restingPlaceId: e.resting_place_id ?? null,
        branchId: e.related_person_id
          ? (personBranch.get(e.related_person_id) ?? null)
          : null,
      });
      continue;
    }

    // Lunar event
    if (e.lunar_month && e.lunar_day) {
      const tryYears = e.is_yearly
        ? [today.getFullYear(), today.getFullYear() + 1]
        : e.lunar_year
          ? [e.lunar_year]
          : [];
      for (const sy of tryYears) {
        const iso = lunarAnniversaryInSolarYear(
          {
            month: e.lunar_month,
            day: e.lunar_day,
            isLeap: e.lunar_is_leap,
          },
          sy,
        );
        if (!iso) continue;
        const days = diffDays(today, iso);
        if (days < 0 || days > daysAhead) continue;
        out.push({
          key: `${e.event_type === "tomb_visit" ? "tomb_visit" : "custom"}:${e.id}:${iso}`,
          kind: e.event_type === "tomb_visit" ? "tomb_visit" : "custom",
          title: e.title,
          date: iso,
          daysUntil: days,
          eventId: e.id,
          personId: e.related_person_id ?? undefined,
          restingPlaceId: e.resting_place_id ?? null,
        });
        break; // first matching solar year is enough
      }
    }
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Variant input for the giỗ source — needs the lunar anniversary
 * columns which PersonForTree doesn't carry. The Events page fetches
 * them separately and passes them here.
 */
export interface PersonAnniversary {
  id: string;
  full_name: string;
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
  death_anniv_lunar_is_leap: boolean;
  generation: number | null;
  branch_id: string | null;
}

export function computeUpcomingAnniversaries({
  today,
  daysAhead,
  anniversaries,
  generationOffset = 0,
}: {
  today: Date;
  daysAhead: number;
  anniversaries: PersonAnniversary[];
  /** Offset hiển thị đời (0 mặc định; 1 = Thủy tổ là Đời 0). */
  generationOffset?: number;
}): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (const p of anniversaries) {
    if (!p.death_anniv_lunar_month || !p.death_anniv_lunar_day) continue;
    const tryYears = [today.getFullYear(), today.getFullYear() + 1];
    for (const sy of tryYears) {
      const iso = lunarAnniversaryInSolarYear(
        {
          month: p.death_anniv_lunar_month,
          day: p.death_anniv_lunar_day,
          isLeap: p.death_anniv_lunar_is_leap,
        },
        sy,
      );
      if (!iso) continue;
      const days = diffDays(today, iso);
      if (days < 0 || days > daysAhead) continue;
      out.push({
        key: `anniversary:${p.id}:${iso}`,
        kind: "anniversary",
        title: `Giỗ ${p.full_name}`,
        date: iso,
        daysUntil: days,
        personId: p.id,
        branchId: p.branch_id ?? null,
        subtitle:
          p.generation !== null
            ? `Đời ${p.generation - generationOffset}`
            : undefined,
      });
      break;
    }
  }
  return out;
}
