import { describe, expect, it } from "vitest";

import { isoToVi, maskViDate, parseIso, toIso, viToIso } from "@/lib/isoDate";

describe("isoDate", () => {
  it("parse / format ngày hợp lệ", () => {
    expect(parseIso("2026-11-23")).toEqual({ y: 2026, m: 11, d: 23 });
    expect(toIso({ y: 2026, m: 3, d: 5 })).toBe("2026-03-05");
    expect(isoToVi("2026-03-05")).toBe("05/03/2026");
  });

  it("từ chối ngày không tồn tại", () => {
    expect(parseIso("2026-02-30")).toBeNull();
    expect(parseIso("2026-13-01")).toBeNull();
    expect(viToIso("31/04/2026")).toBeNull();
    expect(isoToVi("")).toBe("");
  });

  it("năm nhuận", () => {
    expect(viToIso("29/02/2024")).toBe("2024-02-29");
    expect(viToIso("29/02/2025")).toBeNull();
  });

  it("ô gõ tự chèn dấu / và bỏ ký tự lạ", () => {
    expect(maskViDate("2")).toBe("2");
    expect(maskViDate("231")).toBe("23/1");
    expect(maskViDate("23112026")).toBe("23/11/2026");
    expect(maskViDate("23/11/2026999")).toBe("23/11/2026");
    expect(maskViDate("ab12")).toBe("12");
  });

  it("dd/mm/yyyy → yyyy-mm-dd", () => {
    expect(viToIso("23/11/2026")).toBe("2026-11-23");
    expect(viToIso("23/11/26")).toBeNull();
  });
});
