import { describe, expect, it } from "vitest";

import { idsWithinDepth, levelsFromDepth } from "@/lib/tree/depthFilter";
import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Cắt số đời cho cây 3D.
 *
 * Phải khớp CÁCH HIỂU của cây 2D ("3 đời" tính cả người làm tâm = 2 tầng
 * mỗi phía). Lệch cách hiểu thì cùng một lựa chọn cho ra hai cây khác
 * nhau ở hai chế độ, và người dùng nghĩ dữ liệu hỏng.
 *
 * Cây dựng để test: ông → cha → tôi → con → cháu, mỗi đời một gia đình,
 * cộng một người vợ ở đời "tôi" và một nhánh chú/bác để kiểm lan ngang.
 */

const person = (id: string, birthFamily: string | null = null): PersonForTree =>
  ({
    id,
    full_name: id,
    gender: "M",
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: null,
    birth_family_id: birthFamily,
    branch_id: null,
    photo_path: null,
  }) as PersonForTree;

const family = (
  id: string,
  husband: string | null,
  wife: string | null,
): FamilyForTree => ({
  id,
  husband_id: husband,
  wife_id: wife,
  spouse_order: null,
  created_at: null,
});

// ong ─ f1 ─> cha, chu
// cha ─ f2 ─> toi
// toi + vo ─ f3 ─> con
// con ─ f4 ─> chau
const persons = [
  person("ong"),
  person("cha", "f1"),
  person("chu", "f1"),
  person("toi", "f2"),
  person("vo"),
  person("con", "f3"),
  person("chau", "f4"),
];
const families = [
  family("f1", "ong", null),
  family("f2", "cha", null),
  family("f3", "toi", "vo"),
  family("f4", "con", null),
];

const within = (depth: number, focal = "toi") =>
  idsWithinDepth(persons, families, focal, depth);

describe("levelsFromDepth", () => {
  it('"3 đời" = 2 tầng mỗi phía, đúng như cây 2D', () => {
    expect(levelsFromDepth(3)).toBe(2);
    expect(levelsFromDepth(4)).toBe(3);
  });

  it("0 = tất cả", () => {
    expect(levelsFromDepth(0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("idsWithinDepth", () => {
  it("3 đời quanh tôi: cha, con — và cả ông/cháu ở tầng thứ hai", () => {
    const keep = within(3)!;
    expect([...keep].sort()).toEqual(
      ["chau", "cha", "con", "ong", "toi", "vo"].sort(),
    );
  });

  it("2 đời chỉ lấy một tầng mỗi phía", () => {
    const keep = within(2)!;
    expect(keep.has("cha")).toBe(true);
    expect(keep.has("con")).toBe(true);
    expect(keep.has("ong")).toBe(false);
    expect(keep.has("chau")).toBe(false);
  });

  it("luôn kéo theo vợ/chồng của người đang hiện", () => {
    // Cắt mất vợ của người đang hiện thì cây trông như thiếu dữ liệu.
    expect(within(2)!.has("vo")).toBe(true);
  });

  it("KHÔNG lan tiếp từ dâu/rể sang họ nhà người ta", () => {
    // Nếu lan tiếp, qua nhà thông gia là cả cây lại chui vào — đúng thứ
    // mà giới hạn số đời sinh ra để tránh.
    const withInLawParent = [...persons, person("bo_vo"), person("vo2", "f5")];
    const fams = [...families, family("f5", "bo_vo", null)];
    const keep = idsWithinDepth(withInLawParent, fams, "toi", 2)!;
    expect(keep.has("bo_vo")).toBe(false);
  });

  it("anh em (qua đường vòng lên rồi xuống) vẫn vào khi đủ tầng", () => {
    // chu = con của ông → từ "toi" lên 2 (cha, ông) rồi... không xuống
    // được nữa vì đã hết tầng. Với 4 đời thì mới tới.
    expect(within(3)!.has("chu")).toBe(false);
  });

  it("0 đời (tất cả) → không cắt gì, trả null", () => {
    expect(within(0)).toBeNull();
  });

  it("không có người làm tâm thì không cắt", () => {
    expect(idsWithinDepth(persons, families, null, 3)).toBeNull();
    expect(idsWithinDepth(persons, families, "khong-co", 3)).toBeNull();
  });
});
