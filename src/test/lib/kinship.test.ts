import { describe, expect, it } from "vitest";

import {
  computeKinship,
  type KinshipPerson,
} from "@/lib/kinship";

/**
 * Build a small fixture clan. IDs are mnemonic:
 *   - ON, BN = ông nội, bà nội
 *   - OG, BG = ông ngoại, bà ngoại
 *   - F = bố
 *   - M = mẹ
 *   - BR_F_OLDER, BR_F_YOUNGER = anh/em ruột của bố (paternal uncles)
 *   - SIS_F = chị/em gái của bố (paternal aunt)
 *   - BR_M = cậu (maternal uncle)
 *   - SIS_M = dì (maternal aunt)
 *   - ME, SIB = self + sibling
 *   - CHILD = self's son
 *   - COUSIN_P = cousin via father's brother
 */
function buildClan(): Map<string, KinshipPerson> {
  const p = (
    id: string,
    full_name: string,
    gender: "M" | "F",
    birth_year: number | null,
    father_id: string | null,
    mother_id: string | null,
  ): KinshipPerson => ({ id, full_name, gender, birth_year, father_id, mother_id });

  const arr: KinshipPerson[] = [
    p("ON", "Ông nội", "M", 1920, null, null),
    p("BN", "Bà nội", "F", 1925, null, null),
    p("OG", "Ông ngoại", "M", 1922, null, null),
    p("BG", "Bà ngoại", "F", 1927, null, null),

    p("F", "Bố", "M", 1955, "ON", "BN"),
    p("BR_F_OLDER", "Bác trai", "M", 1950, "ON", "BN"),
    p("BR_F_YOUNGER", "Chú", "M", 1960, "ON", "BN"),
    p("SIS_F", "Cô", "F", 1958, "ON", "BN"),

    p("M", "Mẹ", "F", 1957, "OG", "BG"),
    p("BR_M", "Cậu", "M", 1960, "OG", "BG"),
    p("SIS_M", "Dì", "F", 1963, "OG", "BG"),

    p("ME", "Tôi", "M", 1985, "F", "M"),
    p("SIB_YOUNGER", "Em gái ruột", "F", 1990, "F", "M"),
    p("CHILD", "Con trai", "M", 2015, "ME", null),

    // first cousin via paternal uncle
    p("COUSIN_P", "Anh họ", "M", 1980, "BR_F_OLDER", null),
    // first cousin via maternal aunt (younger than ME)
    p("COUSIN_M", "Em họ", "F", 1992, null, "SIS_M"),

    // half-sibling: same father, different mother
    p("HALF", "Em cùng cha", "M", 2000, "F", null),
  ];
  return new Map(arr.map((x) => [x.id, x]));
}

describe("computeKinship — direct lineage", () => {
  const clan = buildClan();

  it("ME → F: father", () => {
    const r = computeKinship("ME", "F", clan);
    expect(r.kind).toBe("direct_descendant");
    expect(r.aCallsB).toBe("cha");
    expect(r.bCallsA).toBe("con trai");
  });

  it("ME → M: mother", () => {
    const r = computeKinship("ME", "M", clan);
    expect(r.aCallsB).toBe("mẹ");
    expect(r.bCallsA).toBe("con trai");
  });

  it("ME → ON: paternal grandfather", () => {
    const r = computeKinship("ME", "ON", clan);
    expect(r.kind).toBe("direct_descendant");
    expect(r.aCallsB).toBe("ông nội");
    expect(r.bCallsA).toBe("cháu trai");
  });

  it("ME → BG: maternal grandmother", () => {
    const r = computeKinship("ME", "BG", clan);
    expect(r.aCallsB).toBe("bà ngoại");
  });

  it("ME → CHILD: son", () => {
    const r = computeKinship("ME", "CHILD", clan);
    expect(r.kind).toBe("direct_descendant");
    expect(r.aCallsB).toBe("con trai");
    expect(r.bCallsA).toBe("cha");
  });
});

describe("computeKinship — siblings", () => {
  const clan = buildClan();

  it("ME → SIB_YOUNGER: full younger sister", () => {
    const r = computeKinship("ME", "SIB_YOUNGER", clan);
    expect(r.kind).toBe("sibling");
    expect(r.aCallsB).toBe("em gái ruột");
    expect(r.bCallsA).toBe("anh ruột");
  });

  it("ME → HALF: half-sibling (same father)", () => {
    const r = computeKinship("ME", "HALF", clan);
    expect(r.kind).toBe("sibling");
    expect(r.aCallsB).toBe("em trai cùng cha");
    expect(r.bCallsA).toBe("anh cùng cha");
  });
});

describe("computeKinship — uncle/aunt", () => {
  const clan = buildClan();

  it("ME → BR_F_OLDER: bác (older paternal uncle)", () => {
    const r = computeKinship("ME", "BR_F_OLDER", clan);
    expect(r.kind).toBe("uncle_aunt");
    expect(r.aCallsB).toBe("bác");
    expect(r.bCallsA).toBe("cháu trai");
  });

  it("ME → BR_F_YOUNGER: chú (younger paternal uncle)", () => {
    const r = computeKinship("ME", "BR_F_YOUNGER", clan);
    expect(r.aCallsB).toBe("chú");
  });

  it("ME → SIS_F: cô (paternal aunt, gender-only)", () => {
    const r = computeKinship("ME", "SIS_F", clan);
    expect(r.aCallsB).toBe("cô");
  });

  it("ME → BR_M: cậu (maternal uncle)", () => {
    const r = computeKinship("ME", "BR_M", clan);
    expect(r.aCallsB).toBe("cậu");
  });

  it("ME → SIS_M: dì (maternal aunt)", () => {
    const r = computeKinship("ME", "SIS_M", clan);
    expect(r.aCallsB).toBe("dì");
  });

  it("BR_F_OLDER → ME: cháu trai (reverse direction)", () => {
    const r = computeKinship("BR_F_OLDER", "ME", clan);
    expect(r.kind).toBe("uncle_aunt");
    expect(r.aCallsB).toBe("cháu trai");
    expect(r.bCallsA).toBe("bác");
  });
});

describe("computeKinship — cousins", () => {
  const clan = buildClan();

  it("ME → COUSIN_P: anh họ (paternal first cousin, older)", () => {
    const r = computeKinship("ME", "COUSIN_P", clan);
    expect(r.kind).toBe("cousin");
    expect(r.aCallsB).toBe("anh họ");
    expect(r.bCallsA).toBe("em trai họ");
  });

  it("ME → COUSIN_M: em họ (maternal first cousin, younger female)", () => {
    const r = computeKinship("ME", "COUSIN_M", clan);
    expect(r.kind).toBe("cousin");
    expect(r.aCallsB).toBe("em gái họ");
    expect(r.bCallsA).toBe("anh họ");
  });
});

describe("computeKinship — edges", () => {
  const clan = buildClan();

  it("same person", () => {
    const r = computeKinship("ME", "ME", clan);
    expect(r.kind).toBe("same");
  });

  it("unrelated (different roots)", () => {
    const unrelated = new Map(clan);
    unrelated.set("STRANGER", {
      id: "STRANGER",
      full_name: "Người ngoài",
      gender: "M",
      birth_year: 1980,
      father_id: null,
      mother_id: null,
    });
    const r = computeKinship("ME", "STRANGER", unrelated);
    expect(r.kind).toBe("unrelated");
  });

  it("missing person id", () => {
    const r = computeKinship("ME", "DOES_NOT_EXIST", clan);
    expect(r.kind).toBe("unrelated");
  });

  it("falls back to bác/chú when ages unknown", () => {
    const partial = new Map(clan);
    const oldUncle = clan.get("BR_F_OLDER")!;
    partial.set("BR_F_OLDER", { ...oldUncle, birth_year: null });
    const fatherNoYear = clan.get("F")!;
    partial.set("F", { ...fatherNoYear, birth_year: null });
    const r = computeKinship("ME", "BR_F_OLDER", partial);
    expect(r.aCallsB).toBe("bác/chú");
  });
});
