import { describe, expect, it } from "vitest";

import type { PersonForTree } from "@/lib/queries/tree";
import {
  bucketOfYear,
  computeClanTimeline,
  groupByBucket,
  yearOf,
} from "@/lib/timeline/computeClanTimeline";
import { erasOverlapping, getEraCards } from "@/lib/timeline/eras";

function p(
  id: string,
  name: string,
  opts: Partial<PersonForTree> = {},
): PersonForTree {
  return {
    id,
    full_name: name,
    gender: "M",
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: null,
    birth_family_id: null,
    branch_id: null,
    photo_path: null,
    ...opts,
  };
}

describe("bucketOfYear — cỡ gom tự co giãn", () => {
  it("từ 1800: thập niên", () => {
    const b = bucketOfYear(1957);
    expect([b.unit, b.from, b.to, b.id]).toEqual([
      "decade",
      1950,
      1959,
      "decade:1950",
    ]);
  });
  it("1800–1899 vẫn là thập niên; 1500–1799: nửa thế kỷ", () => {
    expect(bucketOfYear(1880).id).toBe("decade:1880");
    const b = bucketOfYear(1723);
    expect([b.unit, b.from, b.to]).toEqual(["half-century", 1700, 1749]);
  });
  it("trước 1500: thế kỷ — năm 1200 thuộc thế kỷ 12, 1201 thuộc thế kỷ 13", () => {
    expect([bucketOfYear(1200).from, bucketOfYear(1200).to]).toEqual([1101, 1200]);
    expect([bucketOfYear(1201).from, bucketOfYear(1201).to]).toEqual([1201, 1300]);
  });
  it("ranh giới 1800 và 1500", () => {
    expect(bucketOfYear(1799).unit).toBe("half-century");
    expect(bucketOfYear(1800).unit).toBe("decade");
    expect(bucketOfYear(1499).unit).toBe("century");
    expect(bucketOfYear(1500).unit).toBe("half-century");
  });
});

describe("yearOf", () => {
  it("đọc năm từ ngày đầy đủ, chỉ năm; null khi rỗng/sai", () => {
    expect(yearOf("1950-03-04")).toBe(1950);
    expect(yearOf("1200")).toBe(1200);
    expect(yearOf(null)).toBeNull();
    expect(yearOf("abcd")).toBeNull();
  });
});

describe("computeClanTimeline", () => {
  it("rỗng khi không có người nào có năm", () => {
    expect(computeClanTimeline([p("a", "A")])).toEqual([]);
  });

  it("Thuỷ tổ là mốc đầu và được bật sẵn", () => {
    const out = computeClanTimeline([
      p("r", "Cụ Tổ", { is_root: true, birth_date: "1880-01-01" }),
      p("c", "Con", { birth_date: "1905-05-05", birth_family_id: "f" }),
    ]);
    expect(out[0].kind).toBe("root");
    expect(out[0].recommended).toBe(true);
    expect(out[0].bucket.id).toBe("decade:1880");
    expect(out[0].title).toContain("Cụ Tổ");
  });

  it("không có is_root: lấy người sinh sớm nhất không có cha mẹ", () => {
    const out = computeClanTimeline([
      p("c", "Con", { birth_date: "1905-05-05", birth_family_id: "f" }),
      p("x", "Ông X", { birth_date: "1870-01-01" }),
    ]);
    expect(out.find((c) => c.kind === "root")?.personIds).toEqual(["x"]);
  });

  it("mỗi đời có một mốc 'Đời N bắt đầu', bỏ qua đời của Thuỷ tổ, theo offset", () => {
    const out = computeClanTimeline(
      [
        p("r", "Tổ", { is_root: true, birth_date: "1880-01-01", generation: 1 }),
        p("a", "A", { birth_date: "1905-01-01", generation: 2 }),
        p("b", "B", { birth_date: "1907-01-01", generation: 2 }),
        p("c", "C", { birth_date: "1930-01-01", generation: 3 }),
      ],
      { generationOffset: 1 },
    );
    const gens = out.filter((c) => c.kind === "generation");
    expect(gens.map((g) => g.key)).toEqual([
      "decade:1900:generation:2",
      "decade:1930:generation:3",
    ]);
    expect(gens[0].title).toContain("1");
    expect(gens[0].personIds).toEqual(["a"]);
  });

  it("gom sinh nở theo giai đoạn: ≥2 mới có mốc, ≥3 mới bật sẵn", () => {
    const out = computeClanTimeline([
      p("a", "A", { birth_date: "1950-01-01" }),
      p("b", "B", { birth_date: "1952-01-01" }),
      p("c", "C", { birth_date: "1960-01-01" }),
      p("d", "D", { birth_date: "1961-01-01" }),
      p("e", "E", { birth_date: "1963-01-01" }),
    ]);
    const births = out.filter((c) => c.kind === "births");
    expect(births.map((b) => [b.bucket.id, b.recommended])).toEqual([
      ["decade:1950", false],
      ["decade:1960", true],
    ]);
  });

  it("mốc tưởng nhớ chỉ tính người đã mất và không bật sẵn", () => {
    const out = computeClanTimeline([
      p("a", "A", { is_living: false, death_date: "1990-01-01" }),
      p("b", "B", { is_living: true, death_date: "1991-01-01" }),
    ]);
    const deaths = out.filter((c) => c.kind === "deaths");
    expect(deaths).toHaveLength(1);
    expect(deaths[0].personIds).toEqual(["a"]);
    expect(deaths[0].recommended).toBe(false);
  });

  it("ảnh đại diện ưu tiên người đã mất có ảnh", () => {
    const out = computeClanTimeline([
      p("alive", "Sống", { birth_date: "1950-01-01", photo_path: "a.jpg" }),
      p("dead", "Mất", {
        birth_date: "1951-01-01",
        photo_path: "b.jpg",
        is_living: false,
      }),
    ]);
    expect(out.find((c) => c.kind === "births")?.photoPersonId).toBe("dead");
  });

  it("dòng họ lịch sử từ năm 1200: gom theo thế kỷ, sắp theo thời gian, kèm bối cảnh", () => {
    const out = computeClanTimeline([
      p("t", "Tổ", { is_root: true, birth_date: "1200-01-01", generation: 1 }),
      p("a", "A", { birth_date: "1235-01-01", generation: 2 }),
      p("b", "B", { birth_date: "1265-01-01", generation: 3 }),
      p("c", "C", { birth_date: "1700-01-01", generation: 9 }),
    ]);
    const groups = groupByBucket(out);
    expect(groups.map((g) => g.bucket.id)).toEqual([
      "century:1101",
      "century:1201",
      "half-century:1700",
    ]);
    // Thế kỷ 13 giao Nhà Trần (1226–1399) và Nhà Lý (đến 1225)
    const c13 = out.find((c) => c.bucket.id === "century:1201")!;
    expect(c13.eras.map((e) => e.id)).toEqual(["ly", "tran"]);
  });

  it("chỉ bật sẵn tối đa maxRecommended mốc, trải đều, giữ đầu và cuối", () => {
    const people: PersonForTree[] = [];
    for (let i = 0; i < 30; i++) {
      people.push(
        p(`x${i}`, `X${i}`, {
          birth_date: `${1300 + i * 20}-01-01`,
          generation: i + 1,
          is_root: i === 0,
        }),
      );
    }
    const out = computeClanTimeline(people, { maxRecommended: 6 });
    const rec = out.filter((c) => c.recommended);
    expect(rec).toHaveLength(6);
    expect(rec[0].kind).toBe("root");
    expect(rec[rec.length - 1].bucket.from).toBe(
      out[out.length - 1].bucket.from,
    );
    // mỗi giai đoạn tối đa một mốc bật sẵn
    expect(new Set(rec.map((c) => c.bucket.id)).size).toBe(6);
  });

  it("key ổn định giữa các lần tính", () => {
    const people = [
      p("a", "A", { birth_date: "1950-01-01", generation: 1 }),
      p("b", "B", { birth_date: "1952-01-01", generation: 2 }),
    ];
    const k1 = computeClanTimeline(people).map((c) => c.key);
    const k2 = computeClanTimeline([...people].reverse()).map((c) => c.key);
    expect(k2).toEqual(k1);
  });
});

describe("thẻ bối cảnh thời đại", () => {
  it("phủ liền mạch từ 1009 đến nay, không chồng lấn", () => {
    const eras = getEraCards().sort((a, b) => a.from - b.from);
    for (let i = 1; i < eras.length; i++) {
      expect(eras[i].from).toBe(eras[i - 1].to + 1);
    }
    expect(eras[0].from).toBe(1009);
    expect(eras[eras.length - 1].to).toBeGreaterThanOrEqual(2026);
  });
  it("mỗi thẻ có tiêu đề, ≥1 ý và khoá hình", () => {
    for (const e of getEraCards()) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.bullets.length).toBeGreaterThan(0);
      expect(e.iconKey).toBeTruthy();
    }
  });
  it("erasOverlapping lấy đúng thẻ giao khoảng", () => {
    expect(erasOverlapping(1950, 1959).map((e) => e.id)).toEqual([
      "khang-chien-phap",
      "hai-mien",
    ]);
  });
});
