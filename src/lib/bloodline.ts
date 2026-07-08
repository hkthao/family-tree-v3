/**
 * Tập id người HUYẾT THỐNG = thuỷ tổ + toàn bộ con cháu (truy theo cạnh cha→con
 * từ gốc). Người nối vào cây chỉ bằng HÔN NHÂN (dâu/rể) KHÔNG thuộc tập này —
 * kể cả khi họ có cha/mẹ được ghi (cha/mẹ họ không phải hậu duệ thuỷ tổ).
 *
 * Dùng cho cả cây 2D lẫn 3D để đánh dấu dâu/rể (viền đứt) cho nhất quán.
 *
 * Thuật toán: BFS từ (các) thuỷ tổ, đi xuống qua các gia đình mà người hiện tại
 * là vợ/chồng → mọi con trong gia đình đó là huyết thống. Lặp tới hết.
 *
 * Fallback: clan không đánh dấu thuỷ tổ nào → quay về heuristic cũ (ai có
 * birth_family_id thì coi là huyết thống) để không lỡ tô đứt toàn bộ.
 */
export function bloodlineIds(
  persons: { id: string; is_root: boolean; birth_family_id: string | null }[],
  families: { id: string; husband_id: string | null; wife_id: string | null }[],
): Set<string> {
  const childrenByFamily = new Map<string, string[]>();
  for (const p of persons) {
    if (!p.birth_family_id) continue;
    const arr = childrenByFamily.get(p.birth_family_id);
    if (arr) arr.push(p.id);
    else childrenByFamily.set(p.birth_family_id, [p.id]);
  }
  const familiesByParent = new Map<string, string[]>();
  for (const f of families) {
    for (const pid of [f.husband_id, f.wife_id]) {
      if (!pid) continue;
      const arr = familiesByParent.get(pid);
      if (arr) arr.push(f.id);
      else familiesByParent.set(pid, [f.id]);
    }
  }

  const blood = new Set<string>();
  const queue: string[] = [];
  for (const p of persons) {
    if (p.is_root) {
      blood.add(p.id);
      queue.push(p.id);
    }
  }

  // Không có thuỷ tổ → fallback heuristic cũ.
  if (blood.size === 0) {
    for (const p of persons) if (p.birth_family_id) blood.add(p.id);
    return blood;
  }

  while (queue.length) {
    const cur = queue.shift() as string;
    for (const fid of familiesByParent.get(cur) ?? []) {
      for (const cid of childrenByFamily.get(fid) ?? []) {
        if (!blood.has(cid)) {
          blood.add(cid);
          queue.push(cid);
        }
      }
    }
  }
  return blood;
}
