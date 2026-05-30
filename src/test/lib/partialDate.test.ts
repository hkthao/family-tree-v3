import { describe, expect, it } from "vitest";

import {
  dateFromParts,
  formatPartialDate,
  partsFromDate,
} from "@/lib/partialDate";

describe("partialDate.dateFromParts", () => {
  it("all empty → null date + null precision", () => {
    expect(dateFromParts({ year: "", month: "", day: "" })).toEqual({
      date: null,
      precision: null,
    });
  });

  it("year only → 'year' precision with 01-01 day/month placeholder", () => {
    expect(dateFromParts({ year: "1980", month: "", day: "" })).toEqual({
      date: "1980-01-01",
      precision: "year",
    });
  });

  it("year + month → 'month' precision with day = 01", () => {
    expect(dateFromParts({ year: "1980", month: "3", day: "" })).toEqual({
      date: "1980-03-01",
      precision: "month",
    });
  });

  it("full date → 'day' precision", () => {
    expect(dateFromParts({ year: "1980", month: "3", day: "15" })).toEqual({
      date: "1980-03-15",
      precision: "day",
    });
  });

  it("day without month → error", () => {
    expect(() =>
      dateFromParts({ year: "1980", month: "", day: "15" }),
    ).toThrow(/tháng trước/);
  });

  it("month without year → error", () => {
    expect(() => dateFromParts({ year: "", month: "3", day: "" })).toThrow(/năm/);
  });

  it("invalid month → error", () => {
    expect(() =>
      dateFromParts({ year: "1980", month: "13", day: "1" }),
    ).toThrow(/Tháng/);
  });

  it("invalid day for month → error (Feb 30)", () => {
    expect(() =>
      dateFromParts({ year: "1980", month: "2", day: "30" }),
    ).toThrow(/Ngày/);
  });

  it("leap year February 29 is valid", () => {
    expect(dateFromParts({ year: "2000", month: "2", day: "29" })).toEqual({
      date: "2000-02-29",
      precision: "day",
    });
  });

  it("non-leap year February 29 is rejected", () => {
    expect(() =>
      dateFromParts({ year: "1900", month: "2", day: "29" }),
    ).toThrow(/Ngày/);
  });
});

describe("partialDate.partsFromDate (round-trip with dateFromParts)", () => {
  it("year-only round-trip exposes only year", () => {
    expect(
      partsFromDate({ date: "1980-01-01", precision: "year" }),
    ).toEqual({ year: "1980", month: "", day: "" });
  });

  it("month round-trip exposes year + month", () => {
    expect(
      partsFromDate({ date: "1980-03-01", precision: "month" }),
    ).toEqual({ year: "1980", month: "03", day: "" });
  });

  it("day round-trip exposes full date", () => {
    expect(
      partsFromDate({ date: "1980-03-15", precision: "day" }),
    ).toEqual({ year: "1980", month: "03", day: "15" });
  });

  it("null date → empty parts", () => {
    expect(partsFromDate({ date: null, precision: null })).toEqual({
      year: "",
      month: "",
      day: "",
    });
  });
});

describe("partialDate.formatPartialDate", () => {
  it("year precision shows year only", () => {
    expect(formatPartialDate({ date: "1980-01-01", precision: "year" })).toBe(
      "1980",
    );
  });

  it("month precision shows MM/YYYY", () => {
    expect(
      formatPartialDate({ date: "1980-03-01", precision: "month" }),
    ).toBe("03/1980");
  });

  it("day precision shows DD/MM/YYYY", () => {
    expect(formatPartialDate({ date: "1980-03-15", precision: "day" })).toBe(
      "15/03/1980",
    );
  });

  it("null date → empty string", () => {
    expect(formatPartialDate({ date: null, precision: null })).toBe("");
  });
});
