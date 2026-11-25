/**
 * Phạm vi cây con của link chia sẻ có `root_person_id` (scope xem cây): người gốc + mọi con cháu, kèm vợ/chồng và các gia đình
 * nối họ. Dùng chung cho share-view (lọc payload cây) và `part=person` (không cho xem hồ sơ người ngoài phạm vi link).
 */

export interface ScopePerson {
  id: string;
  birth_family_id: string | null;
}
export interface ScopeFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

export function subtreeScope(persons: ScopePerson[], families: ScopeFamily[], rootId: string): { kept: Set<string>; familiesKept: Set<string> } {
  const kept = new Set<string>([rootId]);
  const familyById = new Map(families.map((f) => [f.id, f]));
  const childrenByFamily = new Map<string, string[]>();
  for (const p of persons) {
    if (!p.birth_family_id) continue;
    const arr = childrenByFamily.get(p.birth_family_id) ?? [];
    arr.push(p.id);
    childrenByFamily.set(p.birth_family_id, arr);
  }
  const familiesByParent = new Map<string, string[]>();
  for (const f of families) {
    for (const pid of [f.husband_id, f.wife_id]) {
      if (!pid) continue;
      const arr = familiesByParent.get(pid) ?? [];
      arr.push(f.id);
      familiesByParent.set(pid, arr);
    }
  }
  const queue = [rootId];
  const familiesKept = new Set<string>();
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const fid of familiesByParent.get(cur) ?? []) {
      if (familiesKept.has(fid)) continue;
      familiesKept.add(fid);
      const fam = familyById.get(fid);
      if (!fam) continue;
      // Đưa cả vợ/chồng vào để thẻ trên cây dựng được.
      for (const sp of [fam.husband_id, fam.wife_id]) if (sp && !kept.has(sp)) kept.add(sp);
      for (const c of childrenByFamily.get(fid) ?? []) {
        if (!kept.has(c)) {
          kept.add(c);
          queue.push(c);
        }
      }
    }
  }
  return { kept, familiesKept };
}
