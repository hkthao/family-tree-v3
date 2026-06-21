/**
 * Calendar-aware date input model for the person forms.
 *
 * The schema keeps both calendars side-by-side: `birth_date` (Gregorian)
 * with `birth_date_precision`, plus `birth_lunar_year/month/day/is_leap`.
 * Same for death + `death_anniv_lunar_month/day` (recurring anniversary).
 * Tombstones in Vietnam usually carry **only** the lunar date — so the
 * form needs to accept either calendar and persist both columns.
 *
 * This module is the single round-trip layer:
 *   - `loadCalendarDateValue` — DB row → form state
 *   - `buildPersonDateColumns` — form state → DB row fields
 *
 * Solar mode supports partial precision (year-only, year+month, full).
 * Lunar mode requires a full day-precision input — the conversion needs
 * (day, month, year) and partial lunar wouldn't map cleanly to a solar
 * sort key.
 */

import {
  lunarToSolarString,
  solarStringToLunar,
  type LunarYMD,
} from "@/lib/lunarDate";
import {
  dateFromParts,
  partsFromDate,
  type DateParts,
  type DatePrecision,
} from "@/lib/partialDate";

export type CalendarMode = "solar" | "lunar";

export interface CalendarDateValue {
  mode: CalendarMode;
  parts: DateParts;
  /** Only meaningful when `mode === "lunar"`. */
  isLeap: boolean;
}

export const EMPTY_CALENDAR_DATE: CalendarDateValue = {
  mode: "solar",
  parts: { year: "", month: "", day: "" },
  isLeap: false,
};

/**
 * Empty value that opens on the lunar tab. Used for the death date,
 * where the giỗ is recorded in âm lịch by convention.
 */
export const EMPTY_LUNAR_CALENDAR_DATE: CalendarDateValue = {
  mode: "lunar",
  parts: { year: "", month: "", day: "" },
  isLeap: false,
};

/**
 * Build the form-state value from existing DB columns. Pick the mode
 * the row was most likely captured in: if the solar date is missing
 * but lunar is filled, start in lunar mode so the user sees what was
 * imported (e.g. from a tombstone via Excel/GEDCOM). Otherwise solar.
 *
 * `preferLunarWhenEmpty` biases an *empty* field toward the lunar tab —
 * used for the death date, where the gia phả convention is to record
 * the giỗ in âm lịch (often just tháng/ngày, no year).
 */
export function loadCalendarDateValue(
  input: {
    solarDate: string | null;
    solarPrecision: DatePrecision | null;
    lunarYear: number | null;
    lunarMonth: number | null;
    lunarDay: number | null;
    lunarIsLeap?: boolean | null;
  },
  preferLunarWhenEmpty = false,
): CalendarDateValue {
  const hasSolar = !!(input.solarDate && input.solarPrecision);
  // Lunar entry can be just the year, just tháng/ngày (a giỗ with no
  // year), or any partial — treat any structured lunar field as "this
  // row was captured in âm lịch".
  const hasLunar = !!(input.lunarYear || input.lunarMonth || input.lunarDay);

  if (!hasSolar && hasLunar) {
    return {
      mode: "lunar",
      parts: {
        year: input.lunarYear != null ? String(input.lunarYear) : "",
        month: input.lunarMonth != null ? String(input.lunarMonth) : "",
        day: input.lunarDay != null ? String(input.lunarDay) : "",
      },
      isLeap: !!input.lunarIsLeap,
    };
  }

  if (!hasSolar && !hasLunar && preferLunarWhenEmpty) {
    return {
      mode: "lunar",
      parts: { year: "", month: "", day: "" },
      isLeap: false,
    };
  }

  return {
    mode: "solar",
    parts: partsFromDate({
      date: input.solarDate,
      precision: input.solarPrecision,
    }),
    isLeap: false,
  };
}

export interface PersonDateColumns {
  solar_date: string | null;
  solar_precision: DatePrecision | null;
  lunar_year: number | null;
  lunar_month: number | null;
  lunar_day: number | null;
  lunar_is_leap: boolean;
}

/**
 * Validate + assemble the four-column DB representation from form
 * state. Throws Error(message) on bad input (same convention as
 * `dateFromParts`). The caller surfaces the message in an Alert.
 *
 * Behaviour matrix:
 *   mode=solar, all blank        → all nulls
 *   mode=solar, partial precision → solar set, lunar nulls (lunar
 *                                   would need day-precision to map)
 *   mode=solar, day precision    → solar set + lunar auto-derived
 *   mode=lunar, missing fields   → throws (lunar input needs full ymd)
 *   mode=lunar, full ymd         → lunar stored explicitly + solar
 *                                   derived
 */
export function buildPersonDateColumns(
  value: CalendarDateValue,
): PersonDateColumns {
  const empty: PersonDateColumns = {
    solar_date: null,
    solar_precision: null,
    lunar_year: null,
    lunar_month: null,
    lunar_day: null,
    lunar_is_leap: false,
  };

  const allBlank =
    !value.parts.year && !value.parts.month && !value.parts.day;
  if (allBlank) return empty;

  if (value.mode === "solar") {
    const solar = dateFromParts(value.parts);
    if (!solar.date || !solar.precision) return empty;

    // Lunar only makes sense for day-precision solar — partial dates
    // (year or year+month) lack the granularity to convert.
    if (solar.precision === "day") {
      const lun = solarStringToLunar(solar.date);
      if (lun) {
        return {
          solar_date: solar.date,
          solar_precision: solar.precision,
          lunar_year: lun.year,
          lunar_month: lun.month,
          lunar_day: lun.day,
          lunar_is_leap: lun.isLeap,
        };
      }
    }
    return {
      solar_date: solar.date,
      solar_precision: solar.precision,
      lunar_year: null,
      lunar_month: null,
      lunar_day: null,
      lunar_is_leap: false,
    };
  }

  // mode === "lunar" — every field is optional. The year is NOT
  // required: the gia phả convention is that ancestors many đời back
  // were handed down only a giỗ (tháng + ngày âm), no year (user
  // feedback). So we accept tháng/ngày alone and store it in the
  // structured lunar_month / lunar_day columns; solar_date stays null
  // because a lunar→solar conversion needs the year. A full ymd
  // (incl. year) additionally derives solar_date for sort/reminders.
  const yRaw = value.parts.year.trim();
  const mRaw = value.parts.month.trim();
  const dRaw = value.parts.day.trim();

  let lunarYear: number | null = null;
  if (yRaw) {
    const y = Number(yRaw);
    if (!Number.isInteger(y) || y < 1 || y > 9999) {
      throw new Error("Năm âm không hợp lệ.");
    }
    lunarYear = y;
  }
  let lunarMonth: number | null = null;
  let lunarDay: number | null = null;
  if (mRaw) {
    const m = Number(mRaw);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new Error("Tháng âm phải nằm trong 1–12.");
    }
    lunarMonth = m;
  }
  if (dRaw) {
    if (!mRaw) {
      throw new Error(
        "Đã nhập ngày âm thì cũng cần điền tháng âm.",
      );
    }
    const d = Number(dRaw);
    if (!Number.isInteger(d) || d < 1 || d > 30) {
      throw new Error("Ngày âm phải nằm trong 1–30.");
    }
    lunarDay = d;
  }

  const isLeap = !!(value.isLeap && lunarMonth);

  // Full ymd → also derive a solar_date (enables sort + event
  // reminders). Anything less stays lunar-only.
  if (lunarYear !== null && lunarMonth !== null && lunarDay !== null) {
    const lunarValue: LunarYMD = {
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      isLeap,
    };
    const solarString = lunarToSolarString(lunarValue);
    if (!solarString) {
      throw new Error(
        "Ngày âm này không quy đổi ra được dương lịch — kiểm tra lại tháng nhuận / ngày trong tháng.",
      );
    }
    return {
      solar_date: solarString,
      solar_precision: "day",
      lunar_year: lunarYear,
      lunar_month: lunarMonth,
      lunar_day: lunarDay,
      lunar_is_leap: isLeap,
    };
  }

  // Partial input (missing year and/or day) — store the structured
  // lunar fields only, solar_date null.
  return {
    ...empty,
    lunar_year: lunarYear,
    lunar_month: lunarMonth,
    lunar_day: lunarDay,
    lunar_is_leap: isLeap,
  };
}

/**
 * Compute the recurring death-anniversary lunar month/day from a death
 * date input. `null/null` when no day-precision death date.
 */
export function buildDeathAnniversary(value: CalendarDateValue): {
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
  death_anniv_lunar_is_leap: boolean;
} {
  const cols = buildPersonDateColumns(value);
  if (cols.lunar_month && cols.lunar_day) {
    return {
      death_anniv_lunar_month: cols.lunar_month,
      death_anniv_lunar_day: cols.lunar_day,
      death_anniv_lunar_is_leap: cols.lunar_is_leap,
    };
  }
  return {
    death_anniv_lunar_month: null,
    death_anniv_lunar_day: null,
    death_anniv_lunar_is_leap: false,
  };
}

/**
 * When the user flips the calendar tab, re-render the parts in the new
 * calendar so a value typed in the previous mode still makes sense.
 * Returns `null` when no conversion is possible (partial input or
 * out-of-range lunar) — the caller keeps the parts blank.
 */
export function convertPartsAcrossCalendars(
  parts: DateParts,
  fromMode: CalendarMode,
  isLeap: boolean,
): { parts: DateParts; isLeap: boolean } | null {
  if (fromMode === "solar") {
    // solar → lunar: needs day-precision
    if (!parts.year || !parts.month || !parts.day) return null;
    let solar: { date: string | null; precision: DatePrecision | null };
    try {
      solar = dateFromParts(parts);
    } catch {
      return null;
    }
    if (!solar.date || solar.precision !== "day") return null;
    const lun = solarStringToLunar(solar.date);
    if (!lun) return null;
    return {
      parts: {
        year: String(lun.year),
        month: String(lun.month),
        day: String(lun.day),
      },
      isLeap: lun.isLeap,
    };
  }

  // lunar → solar
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  const solar = lunarToSolarString({ year: y, month: m, day: d, isLeap });
  if (!solar) return null;
  const [sy, sm, sd] = solar.split("-");
  return {
    parts: {
      year: String(Number(sy)),
      month: String(Number(sm)),
      day: String(Number(sd)),
    },
    isLeap: false,
  };
}
