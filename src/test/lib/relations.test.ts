import { describe, expect, it } from "vitest";

import {
  ancestorLabel,
  buildRelationsIndex,
  childrenOf,
  descendantRows,
  descendantSummary,
  parentsOf,
  paternalLine,
  siblingsOf,
  spousesOf,
  type RelFamily,
  type RelPerson,
} from "@/lib/relations";

const person = (id: string, name: string, over: Partial<RelPerson> = {}): RelPerson => ({
  id,
  full_name: name,
  gender: "M",
  is_living: true,
  is_root: false,
  birth_date: null,
  death_date: null,
  generation: null,
  birth_family_id: null,
  birth_order: null,
  birth_place: null,
  burial_place: null,
  lifespan_years: null,
  ...over,
});
const fam = (id: string, h: string | null, w: string | null, order: number | null = null): RelFamily => ({
  id,
  husband_id: h,
  wife_id: w,
  spouse_order: order,
  created_at: null,
});

// Kỵ → Cụ → Ông → Cha → A; A có vợ W; A có con C1, C2; C1 có con D1.
const persons = [
  person("ky", "Kỵ"),
  person("cu", "Cụ", { birth_family_id: "f-ky" }),
  person("ong", "Ông", { birth_family_id: "f-cu" }),
  person("cha", "Cha", { birth_family_id: "f-ong" }),
  person("mecha", "Mẹ", { gender: "F" }),
  person("a", "A", { birth_family_id: "f-cha", birth_order: 2, birth_date: "1960-01-01" }),
  person("a0", "Anh A", { birth_family_id: "f-cha", birth_order: 1 }),
  person("w", "Vợ A", { gender: "F", birth_place: "Nghĩa Đàn" }),
  person("c2", "Con hai", { birth_family_id: "f-a", birth_order: 2 }),
  person("c1", "Con một", { birth_family_id: "f-a", birth_order: 1 }),
  person("d1", "Cháu", { birth_family_id: "f-c1" }),
  person("c1w", "Dâu", { gender: "F" }),
];
const families = [
  fam("f-ky", "ky", null),
  fam("f-cu", "cu", null),
  fam("f-ong", "ong", null),
  fam("f-cha", "cha", "mecha"),
  fam("f-a", "a", "w"),
  fam("f-c1", "c1", "c1w"),
];
const idx = buildRelationsIndex(persons, families);

describe("relations", () => {
  it("dòng cha: cha, ông, cụ, kỵ", () => {
    expect(paternalLine(idx, "a").map((p) => p.id)).toEqual(["cha", "ong", "cu", "ky"]);
    expect(ancestorLabel(1)).toBe("Cha");
    expect(ancestorLabel(4)).toBe("Kỵ");
    expect(ancestorLabel(6)).toContain("6");
  });

  it("cha mẹ và anh chị em", () => {
    const p = parentsOf(idx, "a");
    expect(p.father?.id).toBe("cha");
    expect(p.mother?.id).toBe("mecha");
    expect(siblingsOf(idx, "a").map((s) => s.id)).toEqual(["a0"]);
  });

  it("vợ/chồng", () => {
    expect(spousesOf(idx, "a").map((s) => s.person.id)).toEqual(["w"]);
    expect(spousesOf(idx, "w").map((s) => s.person.id)).toEqual(["a"]);
  });

  it("con xếp theo thứ tự con", () => {
    expect(childrenOf(idx, "a").map((c) => c.person.id)).toEqual(["c1", "c2"]);
  });

  it("bảng con cháu theo đời + tóm tắt", () => {
    const rows = descendantRows(idx, "a");
    expect(rows.map((r) => [r.level, r.person.id])).toEqual([
      [1, "c1"],
      [1, "c2"],
      [2, "d1"],
    ]);
    expect(rows[0].spouses.map((s) => s.id)).toEqual(["c1w"]);
    expect(rows[2].father?.id).toBe("c1");
    expect(descendantSummary(rows)).toBe("2 con, 1 cháu");
  });

  it("không lặp vô hạn khi dữ liệu vòng", () => {
    const loop = buildRelationsIndex(
      [person("x", "X", { birth_family_id: "f2" }), person("y", "Y", { birth_family_id: "f1" })],
      [fam("f1", "x", null), fam("f2", "y", null)],
    );
    expect(descendantRows(loop, "x").length).toBeLessThanOrEqual(1);
    expect(paternalLine(loop, "x").length).toBeLessThanOrEqual(2);
  });
});
