/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  computeNextSteps,
  seededRng,
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
  canEdit: true,
  isEnabled: () => false,
  aiOn: false,
  ...o,
});

/** Chỉ các gợi ý bổ sung dữ liệu (bỏ phần mời khám phá). */
const gaps = (i: NextStepInput) =>
  computeNextSteps(i).filter((x) => x.kind === "gap");

describe("computeNextSteps", () => {
  it("không gợi ý gì khi cây rỗng (đã có thẻ 'thêm Thuỷ tổ' riêng)", () => {
    expect(computeNextSteps(base({ persons: [] }))).toEqual([]);
  });

  it("không gợi ý khi mọi thứ đã đủ", () => {
    expect(gaps(base())).toEqual([]);
  });

  it("Thuỷ tổ chưa đánh dấu là ưu tiên số một", () => {
    const s = gaps(
      base({ persons: [P(), P({ is_living: false })], customEvents: 0 }),
    );
    expect(s[0].id).toBe("root");
  });

  it("đếm người mất chưa có ngày mất lẫn ngày giỗ; có giỗ lặp hằng năm thì không tính", () => {
    const s = gaps(
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
      gaps(
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
    const ids = gaps(base({ persons: many, counts: { resting_places: 1, heritage_items: 0 } })).map((x) => x.id);
    expect(ids).toContain("photos");
    expect(ids).toContain("heritage");
  });

  it("chưa tải xong số liệu (undefined) thì không gợi ý theo số liệu đó", () => {
    const ids = gaps(
      base({ todo: undefined, counts: undefined, customEvents: undefined }),
    ).map((x) => x.id);
    expect(ids).toEqual([]);
  });

  it("tiêu đề và phụ đề đủ ngắn để vừa một dòng điện thoại", () => {
    const s = computeNextSteps(
      base({
        isEnabled: () => true,
        aiOn: true,
        persons: Array.from({ length: 12 }, (_, i) =>
          P({ is_root: i === 0, is_living: false, photo_path: null }),
        ),
        todo: [{ category: "missing_parents", count: 9 }],
        counts: { resting_places: 0, heritage_items: 0 },
        customEvents: 0,
      }),
    );
    expect(s.length).toBeGreaterThanOrEqual(15);
    for (const x of s) {
      expect(x.title.length).toBeLessThanOrEqual(30);
      expect(x.hint.length).toBeLessThanOrEqual(42);
    }
  });
});

describe("gợi ý khám phá tính năng", () => {
  const five = Array.from({ length: 6 }, (_, i) => P({ is_root: i === 0 }));
  const disc = (o: Partial<NextStepInput> = {}) =>
    computeNextSteps(base({ persons: five, ...o }))
      .filter((x) => x.kind === "discover")
      .map((x) => x.id);

  it("mời xem cây, tra cứu quan hệ, bản đồ khi cây đã có từ 5 người", () => {
    const ids = disc();
    expect(ids).toEqual(expect.arrayContaining(["tree", "relations", "map", "kinship"]));
    expect(computeNextSteps(base()).filter((x) => x.kind === "discover").map((x) => x.id)).not.toContain("relations");
  });

  it("người chỉ xem không bị gợi ý bổ sung dữ liệu, chỉ được mời khám phá", () => {
    const all = computeNextSteps(
      base({ persons: [P(), ...five], canEdit: false, customEvents: 0 }),
    );
    expect(all.some((x) => x.kind === "gap")).toBe(false);
    expect(all.some((x) => x.id === "share")).toBe(false); // chia sẻ cần quyền sửa
    expect(all.some((x) => x.kind === "discover")).toBe(true);
  });

  it("không mời tính năng đã bị dòng họ tắt; trợ lý AI cần nền tảng bật", () => {
    expect(disc({ isEnabled: () => false })).not.toContain("memory");
    expect(disc({ isEnabled: () => true })).toContain("memory");
    expect(disc({ isEnabled: () => true, aiOn: false })).not.toContain("ai");
    expect(disc({ isEnabled: () => true, aiOn: true })).toContain("ai");
  });

  it("việc bổ sung dữ liệu luôn đứng trước lời mời khám phá", () => {
    const s = computeNextSteps(base({ persons: [P(), ...five] }));
    const firstDiscover = s.findIndex((x) => x.kind === "discover");
    const lastGap = s.map((x) => x.kind).lastIndexOf("gap");
    expect(lastGap).toBeLessThan(firstDiscover);
  });
});

describe("xáo ngẫu nhiên lời mời khám phá", () => {
  const six = Array.from({ length: 6 }, (_, i) => P({ is_root: i === 0 }));
  const input = base({ persons: [P(), ...six], isEnabled: () => true, aiOn: true });
  const ids = (rng?: () => number, kind: "gap" | "discover" = "discover") =>
    computeNextSteps(input, rng).filter((x) => x.kind === kind).map((x) => x.id);

  it("cùng hạt giống cho cùng thứ tự; khác hạt giống thì thường khác", () => {
    expect(ids(seededRng(7))).toEqual(ids(seededRng(7)));
    expect(ids(seededRng(1))).not.toEqual(ids(seededRng(2)));
  });

  it("xáo chỉ đổi thứ tự, không thêm bớt tính năng", () => {
    expect([...ids(seededRng(99))].sort()).toEqual([...ids()].sort());
  });

  it("việc bổ sung dữ liệu không bị xáo và vẫn đứng trước", () => {
    expect(ids(seededRng(5), "gap")).toEqual(ids(undefined, "gap"));
    const s = computeNextSteps(input, seededRng(5));
    expect(s.map((x) => x.kind).lastIndexOf("gap")).toBeLessThan(s.findIndex((x) => x.kind === "discover"));
  });
});

describe("snooze", () => {
  beforeEach(() => localStorage.clear());

  it("ẩn đúng gợi ý của đúng dòng họ trong 14 ngày rồi hiện lại", () => {
    const t0 = 1_000_000;
    expect(isSnoozed("c1", "root", t0)).toBe(false);
    snooze("c1", "root", 14, t0);
    expect(isSnoozed("c1", "root", t0 + 1000)).toBe(true);
    expect(isSnoozed("c2", "root", t0 + 1000)).toBe(false);
    expect(isSnoozed("c1", "anniv", t0 + 1000)).toBe(false);
    expect(isSnoozed("c1", "root", t0 + 15 * 24 * 3600 * 1000)).toBe(false);
  });
});
