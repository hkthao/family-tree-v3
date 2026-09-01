import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Gom con theo từng cuộc hôn nhân cho kiểu xem "cây thư mục".
 *
 * Ba luật, đều rút ra từ DỮ LIỆU THẬT (đo trên production 01/09/2026,
 * 9.309 người) chứ không từ cảm giác:
 *
 * 1. **Một vợ/chồng → KHÔNG thêm tầng.** 92% người đã kết hôn chỉ có một
 *    cuộc hôn nhân; cho ai cũng một tầng "hôn nhân" là cây cao gấp đôi
 *    mà không thêm thông tin nào, và phải bấm thêm một lần mới thấy con.
 *
 * 2. **Không bịa thứ bậc vợ.** `spouse_order` mới ghi ở 1.078/4.466 gia
 *    đình — 76% bỏ trống. Có ghi thì gọi "Vợ cả / Vợ hai"; không ghi thì
 *    chỉ nêu tên. Gọi bừa "vợ cả" trong gia phả là chuyện đụng chạm thật.
 *
 * 3. **"Chưa ghi vợ/chồng" là ca PHỔ BIẾN NHẤT, không phải ngoại lệ.**
 *    793 gia đình chỉ có chồng → 1.588 người con không rõ mẹ, gấp năm
 *    lần số ca đa thê. Nên nó phải có nhãn tử tế, không phải chỗ vá víu.
 */

export interface FolderChild {
  id: string;
  name: string;
  gender: "M" | "F";
  generation: number | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  /** Có con hay không — để biết có vẽ mũi tên bung hay không. */
  hasChildren: boolean;
}

export interface FolderGroup {
  /** id gia đình; dùng làm khoá React. */
  familyId: string;
  /** Vợ/chồng trong cuộc hôn nhân này; null = chưa ghi. */
  spouseName: string | null;
  spouseId: string | null;
  /** "Vợ cả", "Vợ hai"… chỉ khi spouse_order có ghi. */
  rankLabel: string | null;
  children: FolderChild[];
}

export interface FolderNodeContent {
  /**
   * Con hiện THẲNG dưới người này, không qua tầng hôn nhân. Chỉ dùng khi
   * người đó có đúng một cuộc hôn nhân có con.
   */
  directChildren: FolderChild[];
  /** Vợ/chồng ghi ngay trên dòng của người đó (ca một cuộc hôn nhân). */
  inlineSpouseName: string | null;
  /** Các nhóm theo cuộc hôn nhân (ca hai cuộc trở lên). */
  groups: FolderGroup[];
}

const RANK_LABEL: Record<number, string> = {
  1: "Vợ cả",
  2: "Vợ hai",
  3: "Vợ ba",
  4: "Vợ tư",
  5: "Vợ năm",
};

/** Nhãn thứ bậc — chỉ khi dữ liệu THẬT SỰ có ghi. */
export function rankLabelFor(
  spouseOrder: number | null,
  spouseGender: "M" | "F" | null,
): string | null {
  if (spouseOrder == null) return null;
  if (spouseGender === "M") return spouseOrder === 1 ? "Chồng cả" : "Chồng sau";
  return RANK_LABEL[spouseOrder] ?? `Vợ thứ ${spouseOrder}`;
}

const year = (d: string | null): number | null =>
  d ? Number(d.slice(0, 4)) || null : null;

export function toFolderChild(
  p: PersonForTree,
  hasChildren: boolean,
): FolderChild {
  return {
    id: p.id,
    name: p.full_name,
    gender: p.gender,
    generation: p.generation,
    birthYear: year(p.birth_date),
    deathYear: year(p.death_date),
    isLiving: p.is_living,
    hasChildren,
  };
}

/**
 * Dựng phần nội dung dưới một người.
 *
 * `families` là các gia đình mà người đó là vợ hoặc chồng; `childrenOf`
 * tra con theo family id; `personById` tra tên vợ/chồng.
 */
export function buildFolderNode(
  personId: string,
  families: FamilyForTree[],
  childrenOf: Map<string, FolderChild[]>,
  personById: Map<string, PersonForTree>,
): FolderNodeContent {
  // Gia đình KHÔNG có con và KHÔNG có vợ/chồng thì chẳng nói lên điều gì
  // — bỏ đi cho đỡ rác. Có vợ mà chưa có con thì vẫn giữ: đó là thông tin.
  const useful = families.filter((f) => {
    const spouseId = f.husband_id === personId ? f.wife_id : f.husband_id;
    return spouseId || (childrenOf.get(f.id) ?? []).length > 0;
  });

  const groups: FolderGroup[] = useful
    .map((f) => {
      const spouseId = f.husband_id === personId ? f.wife_id : f.husband_id;
      const spouse = spouseId ? personById.get(spouseId) : undefined;
      return {
        familyId: f.id,
        spouseId: spouseId ?? null,
        spouseName: spouse?.full_name ?? null,
        rankLabel: rankLabelFor(f.spouse_order, spouse?.gender ?? null),
        children: childrenOf.get(f.id) ?? [],
      };
    })
    // Thứ tự: có ghi thứ bậc thì theo thứ bậc, còn lại giữ nguyên thứ tự
    // đã tải (theo created_at) — đừng tự sắp lại theo tên.
    .sort((a, b) => {
      const ra = families.find((f) => f.id === a.familyId)?.spouse_order;
      const rb = families.find((f) => f.id === b.familyId)?.spouse_order;
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return 0;
    });

  // MỘT cuộc hôn nhân → phẳng: con nằm thẳng dưới, tên vợ/chồng ghi ngay
  // trên dòng của người đó.
  if (groups.length <= 1) {
    const only = groups[0];
    return {
      directChildren: only?.children ?? [],
      inlineSpouseName: only?.spouseName ?? null,
      groups: [],
    };
  }

  return { directChildren: [], inlineSpouseName: null, groups };
}

/** Nhãn của một nhóm hôn nhân, ví dụ "Vợ cả · Lê Thị F" hay "chưa ghi vợ". */
export function groupLabel(
  g: FolderGroup,
  personGender: "M" | "F" = "M",
): string {
  if (!g.spouseName) {
    return personGender === "F" ? "chưa ghi chồng" : "chưa ghi vợ";
  }
  return g.rankLabel ? `${g.rankLabel} · ${g.spouseName}` : g.spouseName;
}
