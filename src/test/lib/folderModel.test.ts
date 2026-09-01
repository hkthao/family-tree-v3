import { describe, expect, it } from "vitest";

import {
  buildFolderNode,
  groupLabel,
  rankLabelFor,
  type FolderChild,
} from "@/lib/tree/folderModel";
import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Cách gom con trong kiểu xem "cây thư mục".
 *
 * Mỗi ca dưới đây tương ứng một con số đo được trên production: 92%
 * người đã kết hôn chỉ có MỘT cuộc hôn nhân, 76% gia đình KHÔNG ghi thứ
 * bậc vợ, và 1.588 người con thuộc gia đình chưa ghi mẹ.
 */

const person = (
  id: string,
  name: string = id,
  gender: "M" | "F" = "M",
): PersonForTree =>
  ({
    id,
    full_name: name,
    gender,
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: 3,
    birth_family_id: null,
    branch_id: null,
    photo_path: null,
  }) as PersonForTree;

const family = (
  id: string,
  husband: string | null,
  wife: string | null,
  order: number | null = null,
): FamilyForTree => ({
  id,
  husband_id: husband,
  wife_id: wife,
  spouse_order: order,
  created_at: null,
});

const child = (id: string): FolderChild => ({
  id,
  name: id,
  gender: "M",
  generation: 4,
  birthYear: null,
  deathYear: null,
  isLiving: true,
  photoPath: null,
  hasChildren: false,
});

const people = new Map(
  [
    person("A"),
    person("B", "Trần Thị B", "F"),
    person("F", "Lê Thị F", "F"),
    person("G", "Phạm Thị G", "F"),
  ].map((p) => [p.id, p]),
);

describe("buildFolderNode — một cuộc hôn nhân", () => {
  it("KHÔNG thêm tầng: con nằm thẳng dưới, tên vợ ghi trên dòng của cha", () => {
    // 92% trường hợp rơi vào đây. Thêm tầng cho tất cả là cây cao gấp
    // đôi mà chẳng thêm thông tin nào.
    const node = buildFolderNode(
      "A",
      [family("f1", "A", "B")],
      new Map([["f1", [child("C"), child("D")]]]),
      people,
    );
    expect(node.groups).toEqual([]);
    expect(node.inlineSpouseName).toBe("Trần Thị B");
    expect(node.directChildren.map((c) => c.id)).toEqual(["C", "D"]);
  });

  it("chưa ghi vợ mà có con → vẫn phẳng, không nhãn thừa", () => {
    // 1.588 người con thuộc ca này — nó là chuyện thường, không phải
    // ngoại lệ cần cảnh báo.
    const node = buildFolderNode(
      "A",
      [family("f1", "A", null)],
      new Map([["f1", [child("C")]]]),
      people,
    );
    expect(node.inlineSpouseName).toBeNull();
    expect(node.directChildren).toHaveLength(1);
    expect(node.groups).toEqual([]);
  });

  it("có vợ nhưng chưa có con vẫn giữ — đó là thông tin", () => {
    const node = buildFolderNode(
      "A",
      [family("f1", "A", "B")],
      new Map(),
      people,
    );
    expect(node.inlineSpouseName).toBe("Trần Thị B");
  });

  it("gia đình rỗng (không vợ, không con) thì bỏ đi cho đỡ rác", () => {
    const node = buildFolderNode(
      "A",
      [family("f1", "A", null)],
      new Map(),
      people,
    );
    expect(node.inlineSpouseName).toBeNull();
    expect(node.directChildren).toEqual([]);
    expect(node.groups).toEqual([]);
  });
});

describe("ảnh và thông tin vợ đi kèm nhóm", () => {
  it("nhóm mang theo đủ thông tin vợ để vẽ ảnh và năm sinh", () => {
    // Node hiện vợ chồng cùng dòng nên phải có ảnh + năm của vợ, không
    // chỉ mỗi cái tên.
    const node = buildFolderNode(
      "A",
      [family("f1", "A", "F", 1), family("f2", "A", "G")],
      new Map([["f1", [child("H")]]]),
      people,
    );
    expect(node.groups[0].spouse?.name).toBe("Lê Thị F");
    expect(node.groups[0].spouse?.gender).toBe("F");
  });

  it("ca một vợ trả về vợ đầy đủ để ghép chung dòng", () => {
    const node = buildFolderNode(
      "A",
      [family("f1", "A", "B")],
      new Map([["f1", [child("C")]]]),
      people,
    );
    expect(node.inlineSpouse?.id).toBe("B");
    expect(node.inlineSpouse?.name).toBe("Trần Thị B");
  });
});

describe("buildFolderNode — hai cuộc hôn nhân trở lên", () => {
  const families = [
    family("f1", "A", "F", 1),
    family("f2", "A", "G"),
    family("f3", "A", null),
  ];
  const kids = new Map([
    ["f1", [child("H"), child("I")]],
    ["f2", [child("L")]],
    ["f3", [child("N")]],
  ]);

  it("mỗi cuộc hôn nhân thành một nhóm, không còn con phẳng", () => {
    const node = buildFolderNode("A", families, kids, people);
    expect(node.directChildren).toEqual([]);
    expect(node.groups.map((g) => g.familyId)).toEqual(["f1", "f2", "f3"]);
  });

  it("có ghi thứ bậc thì xếp trước, không ghi thì giữ nguyên thứ tự tải", () => {
    const node = buildFolderNode(
      "A",
      [family("f2", "A", "G"), family("f1", "A", "F", 1)],
      kids,
      people,
    );
    expect(node.groups[0].familyId).toBe("f1");
  });

  it("nhóm chưa ghi vợ vẫn hiện đủ con của nó", () => {
    const node = buildFolderNode("A", families, kids, people);
    const unknown = node.groups.find((g) => g.familyId === "f3")!;
    expect(unknown.spouseName).toBeNull();
    expect(unknown.children.map((c) => c.id)).toEqual(["N"]);
  });
});

describe("nhãn thứ bậc — KHÔNG bịa khi dữ liệu trống", () => {
  it("chưa ghi thứ bậc thì không có nhãn", () => {
    // 76% gia đình bỏ trống spouse_order. Gọi bừa "vợ cả" trong gia phả
    // là chuyện đụng chạm thật.
    expect(rankLabelFor(null, "F")).toBeNull();
  });

  it("có ghi thì gọi đúng tên gọi tiếng Việt", () => {
    expect(rankLabelFor(1, "F")).toBe("Vợ cả");
    expect(rankLabelFor(2, "F")).toBe("Vợ hai");
    expect(rankLabelFor(9, "F")).toBe("Vợ thứ 9");
  });

  it("người trong họ là nữ thì vợ/chồng đảo lại", () => {
    expect(rankLabelFor(1, "M")).toBe("Chồng cả");
  });
});

describe("groupLabel", () => {
  const g = (spouseName: string | null, rank: string | null) => ({
    familyId: "f",
    spouse: spouseName
      ? {
          id: "s",
          name: spouseName,
          gender: "F" as const,
          birthYear: null,
          deathYear: null,
          isLiving: true,
          photoPath: null,
        }
      : null,
    spouseId: spouseName ? "s" : null,
    spouseName,
    rankLabel: rank,
    children: [],
  });

  it("ghép thứ bậc với tên khi có cả hai", () => {
    expect(groupLabel(g("Lê Thị F", "Vợ cả"))).toBe("Vợ cả · Lê Thị F");
  });

  it("chỉ có tên thì chỉ nêu tên", () => {
    expect(groupLabel(g("Phạm Thị G", null))).toBe("Phạm Thị G");
  });

  it("chưa ghi thì nói theo giới của người trong họ", () => {
    expect(groupLabel(g(null, null), "M")).toBe("chưa ghi vợ");
    expect(groupLabel(g(null, null), "F")).toBe("chưa ghi chồng");
  });
});
