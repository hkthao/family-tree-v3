import { describe, expect, it } from "vitest";

import {
  ACTIVITIES,
  dayAuspice,
  describeDay,
  findGoodDays,
} from "@/lib/almanac";

const TRUC_NAMES = [
  "Kiến", "Trừ", "Mãn", "Bình", "Định", "Chấp",
  "Phá", "Nguy", "Thành", "Thu", "Khai", "Bế",
];

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

describe("almanac describeDay (trực + việc nên/kiêng)", () => {
  it("returns a well-formed day info with a valid trực", () => {
    const d = describeDay("2026-07-11");
    expect(d).not.toBeNull();
    expect(TRUC_NAMES).toContain(d!.truc.name);
    expect(["good", "normal", "bad"]).toContain(d!.level);
    expect(d!.solar).toEqual({ day: 11, month: 7, year: 2026 });
    expect(d!.weekday).toBe(6); // 2026-07-11 là Thứ Bảy
  });

  it("cycles through many distinct trực over a month", () => {
    const names = new Set<string>();
    const base = Date.UTC(2026, 2, 1);
    for (let i = 0; i < 30; i++) {
      const iso = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
      names.add(describeDay(iso)!.truc.name);
    }
    // 30 ngày liên tiếp phải quét qua gần hết 12 trực.
    expect(names.size).toBeGreaterThanOrEqual(10);
  });

  it("is deterministic for the same date + activity", () => {
    expect(describeDay("2026-03-20", "cuoi-hoi")).toEqual(
      describeDay("2026-03-20", "cuoi-hoi"),
    );
  });

  it("nên/kiêng never overlap for a given day", () => {
    const base = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 40; i++) {
      const iso = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
      const d = describeDay(iso)!;
      const overlap = d.nen.filter((x) => d.kieng.includes(x));
      expect(overlap).toEqual([]);
    }
  });
});

describe("almanac findGoodDays", () => {
  it("returns only good days, all inside the range", () => {
    const start = "2026-08-01";
    const end = "2026-10-31";
    const days = findGoodDays(start, end, "cuoi-hoi");
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(d.level).toBe("good");
      expect(d.iso >= start && d.iso <= end).toBe(true);
    }
  });

  it("is sorted ascending by date", () => {
    const days = findGoodDays("2026-08-01", "2026-10-31");
    const isos = days.map((d) => d.iso);
    expect([...isos].sort()).toEqual(isos);
  });

  it("respects the chosen activity (avoids trực that kiêng it)", () => {
    // Ngày Phá kiêng cưới hỏi → không ngày cưới-hỏi nào rơi vào trực Phá.
    const days = findGoodDays("2026-01-01", "2026-06-30", "cuoi-hoi");
    for (const d of days) {
      expect(d.truc.name).not.toBe("Phá");
    }
  });

  it("returns [] for an inverted range", () => {
    expect(findGoodDays("2026-05-10", "2026-05-01")).toEqual([]);
  });

  it("caps a huge range without hanging", () => {
    // Giới hạn 400 ngày — quét 10 năm vẫn trả về nhanh, không vô hạn.
    const days = findGoodDays("2026-01-01", "2036-01-01", "cung-le");
    expect(days.length).toBeGreaterThan(0);
    // 400 ngày quét, số ngày tốt phải nhỏ hơn 400.
    expect(days.length).toBeLessThan(400);
  });
});

describe("almanac ACTIVITIES", () => {
  it("has 8 activities with unique keys and non-empty labels", () => {
    expect(ACTIVITIES).toHaveLength(8);
    const keys = new Set(ACTIVITIES.map((a) => a.key));
    expect(keys.size).toBe(8);
    for (const a of ACTIVITIES) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.emoji.length).toBeGreaterThan(0);
    }
  });
});
