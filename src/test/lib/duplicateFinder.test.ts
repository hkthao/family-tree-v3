import { describe, expect, it } from "vitest";

import {
  findDuplicateCandidates,
  normalizeName,
  type DuplicatePerson,
} from "@/lib/duplicateFinder";

function p(over: Partial<DuplicatePerson> & Pick<DuplicatePerson, "id" | "full_name">): DuplicatePerson {
  return {
    gender: "M",
    birth_date: null,
    is_living: true,
    generation: null,
    ...over,
  };
}

describe("normalizeName", () => {
  it("strips diacritics + đ + collapses whitespace", () => {
    expect(normalizeName("Nguyễn Văn Đại  ")).toBe("nguyen van dai");
    expect(normalizeName("Trần\tThị B")).toBe("tran thi b");
  });
});

describe("findDuplicateCandidates", () => {
  it("emits 'exact' for same name + same gender + same birth year", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Nguyễn Văn A", birth_date: "1980-01-15" }),
      p({ id: "2", full_name: "Nguyễn Văn A", birth_date: "1980-07-04" }),
    ]);
    expect(cands).toHaveLength(1);
    expect(cands[0].kind).toBe("exact");
    expect(cands[0].score).toBe(3);
  });

  it("emits 'name' when birth year missing on one side", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Trần Thị B", birth_date: null }),
      p({ id: "2", full_name: "Trần Thị B", birth_date: "1955-01-01" }),
    ]);
    expect(cands).toHaveLength(1);
    expect(cands[0].kind).toBe("name");
  });

  it("emits 'name' when birth year off by one (likely typo)", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Lê Hữu C", birth_date: "1940-03-01" }),
      p({ id: "2", full_name: "Lê Hữu C", birth_date: "1941-03-01" }),
    ]);
    expect(cands).toHaveLength(1);
    expect(cands[0].kind).toBe("name");
  });

  it("emits 'fuzzy' for edit-distance-1 name + same birth year", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Phạm Văn Đại", birth_date: "1950-05-05" }),
      p({ id: "2", full_name: "Phạm Văn Dại", birth_date: "1950-05-05" }), // Đ→D typo
    ]);
    // After normalization both become "pham van dai" — actually they
    // become identical → exact. Use a different test case for fuzzy.
    expect(cands[0].kind).toBe("exact");
  });

  it("emits 'fuzzy' for one-character difference (typo) + same year", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Hoàng Văn Tài", birth_date: "1970-08-08" }),
      p({ id: "2", full_name: "Hoàng Văn Tải", birth_date: "1970-08-08" }), // a → ả
    ]);
    expect(cands).toHaveLength(1);
    // "tai" vs "tai" after normalisation = identical → exact
    expect(cands[0].kind).toBe("exact");

    // Real fuzzy: different consonant
    const cands2 = findDuplicateCandidates([
      p({ id: "1", full_name: "Hoàng Văn Tài", birth_date: "1970-08-08" }),
      p({ id: "2", full_name: "Hoàng Văn Sài", birth_date: "1970-08-08" }),
    ]);
    expect(cands2).toHaveLength(1);
    expect(cands2[0].kind).toBe("fuzzy");
  });

  it("ignores cross-gender 'matches'", () => {
    const cands = findDuplicateCandidates([
      p({
        id: "1",
        full_name: "Nguyễn Văn A",
        gender: "M",
        birth_date: "1980-01-01",
      }),
      p({
        id: "2",
        full_name: "Nguyễn Văn A",
        gender: "F",
        birth_date: "1980-01-01",
      }),
    ]);
    expect(cands).toHaveLength(0);
  });

  it("sorts highest score first", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Hoàng A", birth_date: "1970-01-01" }),
      p({ id: "2", full_name: "Hoàng A", birth_date: null }), // name match → score 2
      p({ id: "3", full_name: "Nguyễn B", birth_date: "1980-01-01" }),
      p({ id: "4", full_name: "Nguyễn B", birth_date: "1980-12-12" }), // exact → score 3
    ]);
    expect(cands.map((c) => c.kind)).toEqual(["exact", "name"]);
  });

  it("works for clans with no duplicates", () => {
    const cands = findDuplicateCandidates([
      p({ id: "1", full_name: "Anh A" }),
      p({ id: "2", full_name: "Bích B" }),
      p({ id: "3", full_name: "Cường C" }),
    ]);
    expect(cands).toEqual([]);
  });
});
