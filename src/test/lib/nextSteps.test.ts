/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  computeNextSteps,
  isSnoozed,
  snooze,
  type NextStepInput,
} from "@/lib/nextSteps";

const P = (o: Partial<NextStepInput["persons"][number]> = {}) => ({
  is_root: false,
  is_living: true,
  death_date: null,
  photo_path: "x.jpg",
  death_anniv_lunar_month: null,
  ...o,
});

const base = (o: Partial<NextStepInput> = {}): NextStepInput => ({
  persons: [P({ is_root: true })],
  todo: [],
  counts: { resting_places: 1, heritage_items: 1 },
  customEvents: 1,
  ...o,
});

describe("computeNextSteps", () => {
  it("không gợi ý gì khi cây rỗng (đã có thẻ 'thêm Thuỷ tổ' riêng)", () => {
    expect(computeNextSteps(base({ persons: [] }))).toEqual([]);
  });

  it("không gợi ý khi mọi thứ đã đủ", () => {
    expect(computeNextSteps(base())).toEqual([]);
  });

  it("Thuỷ tổ chưa đánh dấu là ưu tiên số một", () => {
    const s = computeNextSteps(
      base({ persons: [P(), P({ is_living: false })], customEvents: 0 }),
    );
    expect(s[0].id).toBe("root");
  });

  it("đếm người mất chưa có ngày mất lẫn ngày giỗ; có giỗ lặp hằng năm thì không tính", () => {
    const s = computeNextSteps(
      base({
        persons: [
          P({ is_root: true, is_living: false }),
          P({ is_living: false, death_anniv_lunar_month: 3 }),
          P({ is_living: false, death_date: "1990-01-01" }),
        ],
      }),
    );
    const a = s.find((x) => x.id === "anniv");
    expect(a?.title).toContain("1");
  });

  it("chỉ gợi ý mộ phần khi chưa có mộ nào và đã có ≥3 người mất", () => {
    const dead = (n: number) =>
      Array.from({ length: n }, () => P({ is_living: false, death_date: "1990-01-01" }));
    const ids = (n: number, rp: number) =>
      computeNextSteps(
        base({ persons: [P({ is_root: true }), ...dead(n)], counts: { resting_places: rp, heritage_items: 1 } }),
      ).map((x) => x.id);
    expect(ids(2, 0)).not.toContain("graves");
    expect(ids(3, 0)).toContain("graves");
    expect(ids(3, 2)).not.toContain("graves");
  });

  it("gợi ý ảnh khi <20% người có ảnh và cây ≥5 người; di sản khi ≥10 người", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      P({ is_root: i === 0, photo_path: null }),
    );
    const ids = computeNextSteps(base({ persons: many, counts: { resting_places: 1, heritage_items: 0 } })).map((x) => x.id);
    expect(ids).toContain("photos");
    expect(ids).toContain("heritage");
  });

  it("chưa tải xong số liệu (undefined) thì không gợi ý theo số liệu đó", () => {
    const ids = computeNextSteps(
      base({ todo: undefined, counts: undefined, customEvents: undefined }),
    ).map((x) => x.id);
    expect(ids).toEqual([]);
  });

  it("tiêu đề và phụ đề đủ ngắn để vừa một dòng điện thoại", () => {
    const s = computeNextSteps(
      base({
        persons: Array.from({ length: 12 }, (_, i) =>
          P({ is_root: i === 0, is_living: false, photo_path: null }),
        ),
        todo: [{ category: "missing_parents", count: 9 }],
        counts: { resting_places: 0, heritage_items: 0 },
        customEvents: 0,
      }),
    );
    expect(s.length).toBeGreaterThanOrEqual(5);
    for (const x of s) {
      expect(x.title.length).toBeLessThanOrEqual(30);
      expect(x.hint.length).toBeLessThanOrEqual(42);
    }
  });
});

describe("snooze", () => {
  beforeEach(() => localStorage.clear());

  it("ẩn đúng gợi ý của đúng dòng họ trong 14 ngày rồi hiện lại", () => {
    const t0 = 1_000_000;
    expect(isSnoozed("c1", "root", t0)).toBe(false);
    snooze("c1", "root", t0);
    expect(isSnoozed("c1", "root", t0 + 1000)).toBe(true);
    expect(isSnoozed("c2", "root", t0 + 1000)).toBe(false);
    expect(isSnoozed("c1", "anniv", t0 + 1000)).toBe(false);
    expect(isSnoozed("c1", "root", t0 + 15 * 24 * 3600 * 1000)).toBe(false);
  });
});
