import { describe, expect, it } from "vitest";

import { dayAuspice } from "@/lib/almanac";

const STARS = [
  "Thanh Long", "Minh Đường", "Thiên Hình", "Chu Tước", "Kim Quỹ",
  "Kim Đường", "Bạch Hổ", "Ngọc Đường", "Thiên Lao", "Nguyên Vũ",
  "Tư Mệnh", "Câu Trận",
];
const GOOD_STARS = new Set([
  "Thanh Long", "Minh Đường", "Kim Quỹ", "Kim Đường", "Ngọc Đường", "Tư Mệnh",
]);

describe("almanac dayAuspice", () => {
  it("returns a well-formed result for a valid date", () => {
    const a = dayAuspice("2026-07-11");
    expect(a).not.toBeNull();
    expect(STARS).toContain(a!.star);
    expect(typeof a!.good).toBe("boolean");
    expect(a!.label).toBe(a!.good ? "Hoàng đạo" : "Hắc đạo");
  });

  it("label/good is consistent with the star's auspiciousness", () => {
    // Quét 60 ngày liên tiếp: good phải khớp đúng bảng 6 sao tốt.
    const base = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 60; i++) {
      const d = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
      const a = dayAuspice(d);
      expect(a).not.toBeNull();
      expect(a!.good).toBe(GOOD_STARS.has(a!.star));
    }
  });

  it("always lists exactly 6 giờ hoàng đạo, formatted with hours", () => {
    const a = dayAuspice("2026-07-11");
    expect(a!.goodHours).toHaveLength(6);
    for (const h of a!.goodHours) {
      // Vd "Dần (3h–5h)"
      expect(h).toMatch(
        /^(Tý|Sửu|Dần|Mão|Thìn|Tỵ|Ngọ|Mùi|Thân|Dậu|Tuất|Hợi) \(\d{1,2}h–\d{1,2}h\)$/,
      );
    }
  });

  it("is deterministic for the same date", () => {
    expect(dayAuspice("2026-03-20")).toEqual(dayAuspice("2026-03-20"));
  });

  it("6 hoàng đạo / 6 hắc đạo distribute across a lunar month cycle", () => {
    // Trong một dải đủ dài phải có cả ngày tốt lẫn ngày xấu.
    const base = Date.UTC(2026, 5, 1);
    let good = 0;
    let bad = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
      dayAuspice(d)!.good ? good++ : bad++;
    }
    expect(good).toBeGreaterThan(0);
    expect(bad).toBeGreaterThan(0);
  });
});
