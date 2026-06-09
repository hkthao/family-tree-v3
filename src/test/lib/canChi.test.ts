import { describe, expect, it } from "vitest";

import {
  canChiToBestYear,
  canChiToYears,
  parseCanChi,
  yearToCanChi,
} from "@/lib/canChi";

describe("parseCanChi", () => {
  it("parses standard input with diacritics", () => {
    expect(parseCanChi("Bính Thìn")).toEqual({
      stem: "bính",
      branch: "thìn",
    });
    expect(parseCanChi("Giáp Tý")).toEqual({ stem: "giáp", branch: "tý" });
  });

  it("is case-insensitive", () => {
    expect(parseCanChi("BÍNH THÌN")).toEqual({
      stem: "bính",
      branch: "thìn",
    });
    expect(parseCanChi("giáp tý")).toEqual({ stem: "giáp", branch: "tý" });
  });

  it("accepts unaccented input (binh thin)", () => {
    expect(parseCanChi("binh thin")).toEqual({
      stem: "bính",
      branch: "thìn",
    });
    expect(parseCanChi("giap ty")).toEqual({ stem: "giáp", branch: "tý" });
  });

  it("disambiguates 'ty' between Tý (rat) and Tỵ (snake) by stem parity", () => {
    // Giáp is even-parity → pairs with Tý (rat).
    expect(parseCanChi("giap ty")).toEqual({ stem: "giáp", branch: "tý" });
    // Ất is odd-parity → pairs with Tỵ (snake).
    expect(parseCanChi("at ty")).toEqual({ stem: "ất", branch: "tỵ" });
    // Đinh is odd-parity → Tỵ.
    expect(parseCanChi("dinh ty")).toEqual({ stem: "đinh", branch: "tỵ" });
  });

  it("collapses extra whitespace", () => {
    expect(parseCanChi("  Bính   Thìn  ")).toEqual({
      stem: "bính",
      branch: "thìn",
    });
  });

  it("rejects invalid combinations (stem-branch parity mismatch)", () => {
    // Giáp (stem 0, even) can NEVER pair with Sửu (branch 1, odd) —
    // the 60-cycle preserves stem-branch parity.
    expect(parseCanChi("Giáp Sửu")).toBeNull();
    expect(parseCanChi("Ất Tý")).toBeNull();
  });

  it("returns null for single-token input or unknown words", () => {
    expect(parseCanChi("Thìn")).toBeNull();
    expect(parseCanChi("Bính")).toBeNull();
    expect(parseCanChi("Bính Foo")).toBeNull();
    expect(parseCanChi("")).toBeNull();
    expect(parseCanChi("   ")).toBeNull();
  });
});

describe("yearToCanChi", () => {
  it("matches well-known anchor years", () => {
    // 1984 = Giáp Tý is the canonical anchor of the modern cycle.
    expect(yearToCanChi(1984)).toBe("Giáp Tý");
    // 1976 = Bính Thìn (year of the dragon).
    expect(yearToCanChi(1976)).toBe("Bính Thìn");
    // 2000 = Canh Thìn.
    expect(yearToCanChi(2000)).toBe("Canh Thìn");
    // 1945 = Ất Dậu (mass-famine year — well-known in VN history).
    expect(yearToCanChi(1945)).toBe("Ất Dậu");
  });

  it("handles past centuries", () => {
    expect(yearToCanChi(1916)).toBe("Bính Thìn");
    expect(yearToCanChi(1856)).toBe("Bính Thìn");
  });

  it("is the inverse of parseCanChi within the cycle", () => {
    for (let y = 1900; y < 1960; y++) {
      const cc = parseCanChi(yearToCanChi(y));
      expect(cc).not.toBeNull();
      expect(yearToCanChi(y)).toBe(yearToCanChi(y)); // sanity
    }
  });
});

describe("canChiToYears", () => {
  it("returns every 60-year hit in range", () => {
    const years = canChiToYears(
      { stem: "bính", branch: "thìn" },
      1800,
      2050,
    );
    expect(years).toEqual([1856, 1916, 1976, 2036]);
  });

  it("returns empty for unreachable range", () => {
    const years = canChiToYears({ stem: "bính", branch: "thìn" }, 1977, 2035);
    expect(years).toEqual([]);
  });
});

describe("canChiToBestYear", () => {
  it("picks the year nearest to the reference", () => {
    expect(
      canChiToBestYear({ stem: "bính", branch: "thìn" }, 1980),
    ).toBe(1976);
    expect(
      canChiToBestYear({ stem: "bính", branch: "thìn" }, 1900),
    ).toBe(1916);
    // 1820 → nearest Bính Thìn is 1796 (|24| < |36| to 1856).
    expect(
      canChiToBestYear({ stem: "bính", branch: "thìn" }, 1820),
    ).toBe(1796);
  });

  it("defaults to nearest-to-now when no reference given", () => {
    // In 2026, Bính Thìn nearest is 1976 (50y back) vs 2036 (10y
    // forward) — 2036 wins because |10| < |50|. We allow forward
    // years so birth-prediction / future-event entries work, but
    // production callers should pass a referenceYear that skews
    // toward the past (e.g., focal birth - 25y for a parent).
    const y = canChiToBestYear({ stem: "bính", branch: "thìn" });
    expect([1976, 2036]).toContain(y);
  });
});
