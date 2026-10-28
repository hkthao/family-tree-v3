// ⚠️ FILE ĐƯỢC SAO CHÉP — KHÔNG SỬA Ở ĐÂY.
//
// Bản sao của src/lib/lunarDate.ts cho Edge Function. Khác bản gốc ĐÚNG
// một dòng: specifier "@dqcai/vn-lunar" đổi thành dạng npm: của Deno.
// Mọi thứ còn lại phải giống hệt — src/test/lib/kinshipVendorCopy.test.ts
// kiểm tra điều đó.
//
// Vì sao phải chép: deploy edge function scp riêng supabase/functions/,
// nên import ra ngoài thư mục đó không được đóng gói theo.

// ─── nguyên văn src/lib/lunarDate.ts ──────────────────────────────────
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
  CAN,
  CHI,
  getDayCanChi,
  getLunarDate,
  getSolarDate,
  getYearCanChi,
  TK13,
  TK14,
  TK15,
  TK16,
  TK17,
  TK18,
} from "npm:@dqcai/vn-lunar@1.0.1";

// @dqcai/vn-lunar 1.0.1 chép thiếu chữ số hex cuối ở 54 giá trị trong bảng
// năm 1200–1799 (phần tử thứ 10 của mỗi nhóm: 0x48ab60 → 0x48ab6), nên các
// năm tận cùng 8, 9 quy đổi sai (mùng 5 Tết Kỷ Dậu 1789 ra 06/01 thay vì
// 30/01). Giá trị đúng luôn ≥ 1.000.000 (ngày Tết lệch so với 1/1 được dịch
// trái 17 bit) → giá trị nhỏ hơn chắc chắn bị cắt, nhân 16 là ra bản gốc.
// Sửa tại chỗ một lần khi nạp module (bảng là mảng dùng chung với thư viện);
// chạy lại không đổi gì nữa.
for (const table of [TK13, TK14, TK15, TK16, TK17, TK18]) {
  for (let i = 0; i < table.length; i++) {
    if (table[i] < 1_000_000) table[i] *= 16;
  }
}

// Thư viện viết can thứ ba là "Bình" — đúng là "Bính" (năm Bính Ngọ, ngày
// Bính Dần…). Sửa tại chỗ trong mảng dùng chung → can chi ngày/tháng/năm của
// thư viện đều đúng theo.
if (CAN[2] === "Bình") CAN[2] = "Bính";

/**
 * Can chi của tháng âm. Thư viện tính lệch một can (năm Giáp tháng Giêng ra
 * "Ất Dần"). Phép cổ truyền: năm Giáp/Kỷ tháng Giêng là Bính Dần, năm Ất/Canh
 * là Mậu Dần… — can tháng = (can năm × 2 + tháng + 1) mod 10, chi tháng Giêng
 * là Dần. Tháng nhuận dùng can chi của tháng chính.
 */
function monthCanChi(month: number, year: number): string {
  const yearCan = (year + 6) % 10; // 0 = Giáp
  return `${CAN[(yearCan * 2 + month + 1) % 10]} ${CHI[(month + 1) % 12]}`;
}

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
  if (!input || !input.year) return "";
  const canChi = getYearCanChi(input.year);
  // Year-only and year+month variants — render gracefully without
  // assuming the user knows the exact day. Lunar entries from old
  // sổ tay often only have the year (canh-chi).
  if (!input.month) {
    return `năm ${canChi} ÂL (${input.year})`;
  }
  const leap = input.isLeap ? " nhuận" : "";
  if (!input.day) {
    return `tháng ${input.month}${leap} năm ${canChi} ÂL`;
  }
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
    month: monthCanChi(lunar.month, lunar.year),
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
