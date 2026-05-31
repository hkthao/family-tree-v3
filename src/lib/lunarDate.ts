/**
 * Vietnamese lunar-calendar helpers.
 *
 * Backed by `@dqcai/vn-lunar` — a TypeScript implementation of the
 * Hồ Ngọc Đức algorithm with the Vietnamese timezone (GMT+7) baked in,
 * so conversions match dates printed on tombstones and almanacs used
 * in Vietnam (which differ from the Chinese calendar by ~1 day on a
 * handful of dates each year).
 *
 * Schema columns we round-trip with:
 *   persons.birth_lunar_year / _month / _day / _is_leap
 *   persons.death_lunar_year / _month / _day / _is_leap
 *   persons.death_anniv_lunar_month / _day / _is_leap  (no year — recurring)
 */

import {
  getDayCanChi,
  getLunarDate,
  getMonthCanChi,
  getSolarDate,
  getYearCanChi,
} from "@dqcai/vn-lunar";

export interface LunarYMD {
  year: number;
  month: number;
  day: number;
  isLeap: boolean;
}

export interface LunarAnniversary {
  month: number;
  day: number;
  isLeap: boolean;
}

/** Solar yyyy-mm-dd → lunar Y/M/D + leap flag. */
export function solarStringToLunar(
  isoSolar: string | null | undefined,
): LunarYMD | null {
  if (!isoSolar) return null;
  const [y, m, d] = isoSolar.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  const lunar = getLunarDate(d, m, y);
  return {
    year: lunar.year,
    month: lunar.month,
    day: lunar.day,
    isLeap: !!lunar.leap,
  };
}

/** Lunar Y/M/D (+ leap) → solar yyyy-mm-dd. */
export function lunarToSolarString(input: LunarYMD): string | null {
  const sol = getSolarDate(input.day, input.month, input.year, input.isLeap);
  if (!sol || !sol.year) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(sol.year)}-${pad(sol.month)}-${pad(sol.day)}`;
}

/**
 * Human-friendly lunar full date with Can-Chi year suffix.
 * Example: "15/3 ÂL — năm Canh Thân"
 * Returns "" when all fields are null/undefined.
 */
export function formatLunarDate(input: Partial<LunarYMD> | null | undefined): string {
  if (!input || !input.year || !input.month || !input.day) return "";
  const leap = input.isLeap ? " nhuận" : "";
  const canChi = getYearCanChi(input.year);
  return `${input.day}/${input.month}${leap} ÂL — năm ${canChi}`;
}

/**
 * Ngày giỗ — recurring lunar month/day with no year. Year is dropped
 * because the anniversary repeats each lunar year; for the *first*
 * giỗ users sometimes care about which year died_at maps to.
 * Example: "Ngày 5/4 âm lịch"
 */
export function formatLunarAnniversary(
  input: Partial<LunarAnniversary> | null | undefined,
): string {
  if (!input || !input.month || !input.day) return "";
  const leap = input.isLeap ? " nhuận" : "";
  return `${input.day}/${input.month}${leap} âm lịch`;
}

export interface CanChiTriple {
  day: string;
  month: string;
  year: string;
}

/**
 * Day / Month / Year Can Chi for a solar yyyy-mm-dd input.
 *
 * Day Can Chi runs on a continuous 60-day sexagenary cycle pinned to
 * Julian-day numbers — it doesn't care about lunar new year. Month and
 * year Can Chi follow the *lunar* calendar (the month switches at the
 * solar terms / 立春 boundary), so we convert solar → lunar first and
 * feed the lunar Y/M into the package.
 */
export function getCanChiForSolarDate(
  isoSolar: string | null | undefined,
): CanChiTriple | null {
  if (!isoSolar) return null;
  const [y, m, d] = isoSolar.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  const lunar = getLunarDate(d, m, y);
  return {
    day: getDayCanChi(lunar.jd),
    month: getMonthCanChi(lunar.month, lunar.year),
    year: getYearCanChi(lunar.year),
  };
}

/**
 * Compact rendering of a Can Chi triple — "Ngày Giáp Tý · tháng Bính
 * Dần · năm Giáp Thìn". Suitable for an event-list subtitle.
 */
export function formatCanChiFull(c: CanChiTriple | null | undefined): string {
  if (!c) return "";
  return `Ngày ${c.day} · tháng ${c.month} · năm ${c.year}`;
}

/**
 * Even shorter: "Giáp Tý / Bính Dần / Giáp Thìn" — for tight spaces.
 */
export function formatCanChiShort(c: CanChiTriple | null | undefined): string {
  if (!c) return "";
  return `${c.day} / ${c.month} / ${c.year}`;
}

/**
 * Given a lunar month/day with `is_leap`, find when it falls on the
 * given solar year. Useful for the event-notifier ("when is the next
 * giỗ?"). Returns null if the lunar date doesn't exist in that solar
 * year (rare leap-month edge case).
 */
export function lunarAnniversaryInSolarYear(
  ann: LunarAnniversary,
  solarYear: number,
): string | null {
  // Most anniversaries from year Y fall in solar year Y. But lunar
  // Tết is in late Jan / early Feb, so a lunar date in Jan/Feb of
  // year Y might map to either calendar year Y or Y+1 depending on
  // when Tết fell. We try both and pick the one in `solarYear`.
  for (const y of [solarYear - 1, solarYear, solarYear + 1]) {
    const sol = getSolarDate(ann.day, ann.month, y, ann.isLeap);
    if (sol && sol.year === solarYear) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${solarYear}-${pad(sol.month)}-${pad(sol.day)}`;
    }
  }
  return null;
}
