import { describe, expect, it } from "vitest";

import {
  buildFolderNode,
  groupLabel,
  rankLabelFor,
  visibleGhostSpouses,
  MASKED_SPOUSE_NAME,
  type FolderChild,
  type FolderSpouse,
  type GhostSpouseSource,
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
  spouses: [],
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

describe("dâu/rể ở dòng họ thông gia", () => {
  const localSpouse = (name: string, birthYear: number | null): FolderSpouse => ({
    id: `local-${name}`,
    name,
    gender: "F",
    birthYear,
    deathYear: null,
    isLiving: true,
    photoPath: null,
  });

  const ghost = (
    over: Partial<GhostSpouseSource> = {},
  ): GhostSpouseSource => ({
    linkId: "link-1",
    peerClanId: "clan-b",
    peerClanName: "Họ Trần",
    spouseId: "peer-1",
    spouseFullName: "Trần Thị Mai",
    spouseGender: "F",
    spouseBirthYear: null,
    spouseDeathYear: null,
    spouseIsLiving: true,
    masked: false,
    ...over,
  });

  it("hiện dâu/rể mà dòng họ này chưa có bản ghi", () => {
    const out = visibleGhostSpouses([], [ghost()]);
    expect(out).toHaveLength(1);
    expect(out[0].spouse.name).toBe("Trần Thị Mai");
    expect(out[0].peerClanName).toBe("Họ Trần");
  });

  it("BỎ khi người đó đã có sẵn ở dòng họ này — kẻo đứng hai lần cạnh nhau", () => {
    // Rất nhiều họ tự ghi cô dâu của mình rồi mới nối thông gia.
    const out = visibleGhostSpouses([localSpouse("Trần Thị Mai", null)], [ghost()]);
    expect(out).toEqual([]);
  });

  it("so tên bỏ qua khoảng trắng thừa và chữ hoa", () => {
    const out = visibleGhostSpouses(
      [localSpouse("trần  thị mai", null)],
      [ghost()],
    );
    expect(out).toEqual([]);
  });

  it("chỉ đòi trùng năm sinh khi CẢ HAI bên đều có ghi", () => {
    // Bên kia thường bỏ trống năm sinh; đòi bằng nhau thì không bao giờ
    // khớp, và cùng một người bị vẽ hai lần.
    expect(
      visibleGhostSpouses([localSpouse("Trần Thị Mai", 1970)], [ghost()]),
    ).toEqual([]);
    expect(
      visibleGhostSpouses(
        [localSpouse("Trần Thị Mai", 1970)],
        [ghost({ spouseBirthYear: 1990 })],
      ),
    ).toHaveLength(1);
  });

  it("tên bị che thì cứ hiện — thà thừa còn hơn giấu mất một cuộc hôn nhân", () => {
    const out = visibleGhostSpouses(
      [localSpouse("Trần Thị Mai", null)],
      [ghost({ masked: true, spouseFullName: null })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].spouse.name).toBe(MASKED_SPOUSE_NAME);
  });

  it("cùng một liên kết trả về hai lần thì chỉ vẽ một", () => {
    const out = visibleGhostSpouses([], [ghost(), ghost()]);
    expect(out).toHaveLength(1);
  });

  it("khoá React ổn định theo liên kết + người, không theo thứ tự tải", () => {
    expect(visibleGhostSpouses([], [ghost()])[0].key).toBe(
      "ghost:link-1:peer-1",
    );
  });
});
