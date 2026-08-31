import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Giới hạn số đời hiển thị quanh MỘT người làm tâm.
 *
 * Cây 2D nhờ family-chart lo việc này (`setAncestryDepth` /
 * `setProgenyDepth`). Cây 3D tự dựng đồ thị nên phải tự cắt — và phải
 * cắt theo ĐÚNG cách hiểu đó, nếu không cùng một lựa chọn "3 đời" lại
 * cho ra hai cây khác nhau ở hai chế độ, và người dùng nghĩ dữ liệu
 * hỏng.
 *
 * Cách hiểu: "3 đời" tính CẢ người làm tâm → 2 tầng lên (tổ tiên) và 2
 * tầng xuống (hậu duệ). Dâu/rể của những người đó luôn được kéo theo:
 * cắt mất vợ/chồng của một người đang hiện là cây trông như thiếu.
 */

/** Tầng mỗi phía tương ứng một lựa chọn "số đời". 0 = tất cả. */
export function levelsFromDepth(depth: number): number {
  return depth <= 0 ? Number.POSITIVE_INFINITY : depth - 1;
}

export function idsWithinDepth(
  persons: PersonForTree[],
  families: FamilyForTree[],
  focalId: string | null | undefined,
  depth: number,
): Set<string> | null {
  const levels = levelsFromDepth(depth);
  // Không giới hạn, hoặc không biết lấy ai làm tâm → giữ nguyên cả cây.
  if (!Number.isFinite(levels) || !focalId) return null;
  if (!persons.some((p) => p.id === focalId)) return null;

  const famById = new Map(families.map((f) => [f.id, f]));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };

  for (const p of persons) {
    const fam = p.birth_family_id ? famById.get(p.birth_family_id) : null;
    if (!fam) continue;
    for (const parent of [fam.husband_id, fam.wife_id]) {
      if (!parent) continue;
      push(parentsOf, p.id, parent);
      push(childrenOf, parent, p.id);
    }
  }
  for (const f of families) {
    if (f.husband_id && f.wife_id) {
      push(spousesOf, f.husband_id, f.wife_id);
      push(spousesOf, f.wife_id, f.husband_id);
    }
  }

  /** Lan theo một chiều (lên hoặc xuống) tối đa `levels` bước. */
  const walk = (edges: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>([focalId]);
    let frontier = [focalId];
    for (let step = 0; step < levels && frontier.length; step++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const to of edges.get(id) ?? []) {
          if (seen.has(to)) continue;
          seen.add(to);
          next.push(to);
        }
      }
      frontier = next;
    }
    return seen;
  };

  const keep = new Set<string>([...walk(parentsOf), ...walk(childrenOf)]);

  // Kéo theo vợ/chồng — nhưng KHÔNG lan tiếp từ họ: chỉ một vòng, nếu
  // không thì qua nhà thông gia là cả cây lại chui vào.
  for (const id of [...keep]) {
    for (const s of spousesOf.get(id) ?? []) keep.add(s);
  }
  return keep;
}
