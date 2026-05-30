/**
 * Partial solar dates.
 *
 * Many Vietnamese tombstones record only the year, or year+month. The DB
 * keeps `birth_date` / `death_date` as a real `date` (so sorting and
 * indexing still work) plus a `*_precision` indicator. When precision is
 * "year" we stuff 01-01; "month" → day = 01; "day" → full date. This
 * module is the single place that handles round-tripping between
 * structured form inputs (year/month/day strings) and the (date, precision)
 * pair the DB stores.
 */

export type DatePrecision = "day" | "month" | "year";

export interface PartialDate {
  date: string | null; // ISO yyyy-mm-dd or null
  precision: DatePrecision | null;
}

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

/** Turn a (date, precision) pair into structured form fields. */
export function partsFromDate(input: PartialDate): DateParts {
  if (!input.date || !input.precision) {
    return { year: "", month: "", day: "" };
  }
  const [y, m, d] = input.date.split("-");
  return {
    year: y ?? "",
    month: input.precision === "year" ? "" : m ?? "",
    day: input.precision === "day" ? d ?? "" : "",
  };
}

/**
 * Validate + assemble a (date, precision) from form fields.
 *
 * Returns:
 *   - { date: null, precision: null } when all fields are empty (unknown).
 *   - { date: "yyyy-01-01", precision: "year" } when only year.
 *   - { date: "yyyy-mm-01", precision: "month" } when year + month.
 *   - { date: "yyyy-mm-dd", precision: "day" } when full date.
 *
 * Throws Error("…") for the caller to surface when input is incoherent
 * (day without month, month without year, out-of-range, invalid day for
 * that month/year).
 */
export function dateFromParts(p: DateParts): PartialDate {
  const yRaw = p.year.trim();
  const mRaw = p.month.trim();
  const dRaw = p.day.trim();

  if (!yRaw && !mRaw && !dRaw) {
    return { date: null, precision: null };
  }
  if (!yRaw) {
    throw new Error("Cần nhập năm trước khi nhập tháng hoặc ngày.");
  }

  const year = Number(yRaw);
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new Error("Năm không hợp lệ.");
  }

  if (!mRaw && !dRaw) {
    return { date: `${pad4(year)}-01-01`, precision: "year" };
  }
  if (!mRaw && dRaw) {
    throw new Error("Cần nhập tháng trước khi nhập ngày.");
  }

  const month = Number(mRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Tháng phải nằm trong 1–12.");
  }

  if (!dRaw) {
    return { date: `${pad4(year)}-${pad2(month)}-01`, precision: "month" };
  }

  const day = Number(dRaw);
  const maxDay = daysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new Error(`Ngày phải nằm trong 1–${maxDay} cho tháng ${month}/${year}.`);
  }

  return { date: `${pad4(year)}-${pad2(month)}-${pad2(day)}`, precision: "day" };
}

/** Format a (date, precision) pair for display. Returns "" when unknown. */
export function formatPartialDate(d: PartialDate): string {
  if (!d.date || !d.precision) return "";
  const [y, m, dd] = d.date.split("-");
  switch (d.precision) {
    case "year":
      return y;
    case "month":
      return `${m}/${y}`;
    case "day":
      return `${dd}/${m}/${y}`;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  const monthDays = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthDays[m - 1] ?? 31;
}
