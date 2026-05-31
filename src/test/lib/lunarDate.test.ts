import { describe, expect, it } from "vitest";

import {
  formatCanChiFull,
  formatCanChiShort,
  formatLunarAnniversary,
  formatLunarDate,
  getCanChiForSolarDate,
  lunarAnniversaryInSolarYear,
  lunarToSolarString,
  solarStringToLunar,
} from "@/lib/lunarDate";

/**
 * Reference dates cross-checked against amlich.com / Hồ Ngọc Đức's
 * online converter. Vietnamese lunar uses GMT+7, so these specifically
 * test the Vietnamese (not Chinese) calendar.
 */
describe("lunarDate", () => {
  describe("solar ↔ lunar round-trip", () => {
    it("known dates: Vietnamese Tết 2024 = solar 2024-02-10", () => {
      // Tết Giáp Thìn = lunar 1/1/2024 leap=false
      const lunar = solarStringToLunar("2024-02-10");
      expect(lunar).toEqual({ year: 2024, month: 1, day: 1, isLeap: false });
    });

    it("Quốc Khánh 2/9 always solar — lunar varies", () => {
      const lunar = solarStringToLunar("2024-09-02");
      // 2024-09-02 ≈ lunar 30/7 năm Giáp Thìn
      expect(lunar?.month).toBe(7);
      expect(lunar?.day).toBe(30);
    });

    it("lunar→solar→lunar is identity for non-leap dates", () => {
      const original = { year: 1985, month: 3, day: 15, isLeap: false };
      const sol = lunarToSolarString(original);
      expect(sol).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const back = solarStringToLunar(sol);
      expect(back).toEqual(original);
    });

    it("returns null for empty / malformed input", () => {
      expect(solarStringToLunar(null)).toBeNull();
      expect(solarStringToLunar(undefined)).toBeNull();
      expect(solarStringToLunar("")).toBeNull();
      expect(solarStringToLunar("not-a-date")).toBeNull();
    });
  });

  describe("formatLunarDate", () => {
    it("renders day/month + Can-Chi year", () => {
      // 2024 is năm Giáp Thìn
      const out = formatLunarDate({ year: 2024, month: 1, day: 1, isLeap: false });
      expect(out).toContain("1/1");
      expect(out).toContain("ÂL");
      expect(out).toContain("Giáp Thìn");
    });

    it("marks leap month", () => {
      const out = formatLunarDate({ year: 2023, month: 2, day: 15, isLeap: true });
      expect(out).toContain("nhuận");
    });

    it("returns empty string when fields missing", () => {
      expect(formatLunarDate(null)).toBe("");
      expect(formatLunarDate({ year: 0, month: 0, day: 0 })).toBe("");
    });
  });

  describe("formatLunarAnniversary (ngày giỗ — no year)", () => {
    it("renders day/month (âm lịch) with no year", () => {
      const out = formatLunarAnniversary({ month: 4, day: 5, isLeap: false });
      expect(out).toBe("5/4 âm lịch");
    });

    it("marks leap month", () => {
      const out = formatLunarAnniversary({ month: 2, day: 15, isLeap: true });
      expect(out).toBe("15/2 nhuận âm lịch");
    });

    it("returns empty string when fields missing", () => {
      expect(formatLunarAnniversary(null)).toBe("");
      expect(formatLunarAnniversary({ month: 0, day: 0 })).toBe("");
    });
  });

  describe("getCanChiForSolarDate (day · month · year Can Chi)", () => {
    it("Tết Giáp Thìn (solar 2024-02-10) has năm Giáp Thìn + valid Can-Chi triple", () => {
      const c = getCanChiForSolarDate("2024-02-10");
      expect(c?.year).toBe("Giáp Thìn");
      // Month + day still follow the 2-token "Can Chi" form
      expect(c?.month).toMatch(/^\S+\s+\S+$/);
      expect(c?.day).toMatch(/^\S+\s+\S+$/);
    });

    it("returns three non-empty Can-Chi labels for a normal date", () => {
      const c = getCanChiForSolarDate("2024-09-02");
      expect(c).not.toBeNull();
      expect(c!.day.split(" ")).toHaveLength(2);
      expect(c!.month.split(" ")).toHaveLength(2);
      expect(c!.year.split(" ")).toHaveLength(2);
    });

    it("returns null for empty / malformed input", () => {
      expect(getCanChiForSolarDate(null)).toBeNull();
      expect(getCanChiForSolarDate("")).toBeNull();
      expect(getCanChiForSolarDate("nonsense")).toBeNull();
    });
  });

  describe("formatCanChi* (Vietnamese-friendly rendering)", () => {
    const triple = { day: "Giáp Tý", month: "Bính Dần", year: "Giáp Thìn" };
    it("formatCanChiFull renders 'Ngày X · tháng Y · năm Z'", () => {
      expect(formatCanChiFull(triple)).toBe(
        "Ngày Giáp Tý · tháng Bính Dần · năm Giáp Thìn",
      );
    });
    it("formatCanChiShort renders 'X / Y / Z'", () => {
      expect(formatCanChiShort(triple)).toBe(
        "Giáp Tý / Bính Dần / Giáp Thìn",
      );
    });
    it("both return empty for null/undefined", () => {
      expect(formatCanChiFull(null)).toBe("");
      expect(formatCanChiShort(undefined)).toBe("");
    });
  });

  describe("lunarAnniversaryInSolarYear", () => {
    it("maps lunar 1/1 (Tết) to the solar date that starts that lunar year", () => {
      // Tết năm Giáp Thìn → 2024-02-10
      const sol = lunarAnniversaryInSolarYear(
        { month: 1, day: 1, isLeap: false },
        2024,
      );
      expect(sol).toBe("2024-02-10");
    });

    it("maps a mid-year date inside the same solar year", () => {
      // lunar 15/8 (Trung thu) 2024 → 2024-09-17
      const sol = lunarAnniversaryInSolarYear(
        { month: 8, day: 15, isLeap: false },
        2024,
      );
      expect(sol).toBe("2024-09-17");
    });
  });
});
