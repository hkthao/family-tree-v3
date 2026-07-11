import { describe, expect, it } from "vitest";

import { bloodlineIds } from "@/lib/bloodline";

// Cây nhỏ:
//   R (thuỷ tổ) × W1 (dâu)                → F1 → con C1
//   C1 × W2 (dâu, CÓ cha mẹ ghi: X,Y)     → F2 → con C2
//   X × Y (ngoài dòng)                    → Fext → con W2
//   U: người rời rạc, không thuộc gia đình nào
const persons = [
  { id: "R", is_root: true, birth_family_id: null },
  { id: "W1", is_root: false, birth_family_id: null },
  { id: "C1", is_root: false, birth_family_id: "F1" },
  { id: "W2", is_root: false, birth_family_id: "Fext" }, // dâu CÓ cha mẹ
  { id: "C2", is_root: false, birth_family_id: "F2" },
  { id: "X", is_root: false, birth_family_id: null },
  { id: "Y", is_root: false, birth_family_id: null },
  { id: "U", is_root: false, birth_family_id: null },
];
const families = [
  { id: "F1", husband_id: "R", wife_id: "W1" },
  { id: "F2", husband_id: "C1", wife_id: "W2" },
  { id: "Fext", husband_id: "X", wife_id: "Y" },
];

describe("bloodlineIds", () => {
  it("gồm thuỷ tổ + toàn bộ hậu duệ", () => {
    const blood = bloodlineIds(persons, families);
    expect(blood.has("R")).toBe(true);
    expect(blood.has("C1")).toBe(true);
    expect(blood.has("C2")).toBe(true);
  });

  it("LOẠI dâu/rể — kể cả dâu CÓ cha mẹ được ghi", () => {
    const blood = bloodlineIds(persons, families);
    expect(blood.has("W1")).toBe(false); // dâu không cha mẹ
    expect(blood.has("W2")).toBe(false); // dâu CÓ cha mẹ (X,Y) — vẫn không phải huyết thống
  });

  it("loại người ngoài dòng + người rời rạc", () => {
    const blood = bloodlineIds(persons, families);
    expect(blood.has("X")).toBe(false);
    expect(blood.has("Y")).toBe(false);
    expect(blood.has("U")).toBe(false);
  });

  it("fallback khi KHÔNG có thuỷ tổ: ai có birth_family_id coi là huyết thống", () => {
    const noRoot = persons.map((p) => ({ ...p, is_root: false }));
    const blood = bloodlineIds(noRoot, families);
    expect(blood.has("C1")).toBe(true); // có birth_family_id
    expect(blood.has("C2")).toBe(true);
    expect(blood.has("W2")).toBe(true); // fallback: có birth_family_id
    expect(blood.has("R")).toBe(false); // không root + không birth_family_id
    expect(blood.has("U")).toBe(false);
  });

  it("không lặp vô hạn khi dữ liệu có vòng (an toàn)", () => {
    const cyclic = [
      { id: "A", is_root: true, birth_family_id: "FB" },
      { id: "B", is_root: false, birth_family_id: "FA" },
    ];
    const fams = [
      { id: "FA", husband_id: "A", wife_id: null },
      { id: "FB", husband_id: "B", wife_id: null },
    ];
    const blood = bloodlineIds(cyclic, fams);
    expect(blood.has("A")).toBe(true);
    expect(blood.has("B")).toBe(true);
  });
});
