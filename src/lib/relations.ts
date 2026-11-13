import { t } from "@lingui/core/macro";
/**
 * Tra cứu quan hệ của MỘT người (kiểu bảng Excel gia phả): tổ tiên theo dòng cha, mẹ,
 * vợ/chồng, anh chị em, bác–chú–cô–cậu–dì, và bảng con cháu theo từng đời. Hàm thuần, không
 * gọi mạng — dữ liệu vào là danh sách người + gia đình (cặp vợ chồng) của dòng họ.
 */

export interface RelPerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  birth_date: string | null;
  death_date: string | null;
  generation: number | null;
  birth_family_id: string | null;
  birth_order: number | null;
  birth_place: string | null;
  burial_place: string | null;
  lifespan_years: number | null;
}

export interface RelFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  spouse_order: number | null;
  created_at: string | null;
}

export interface RelationsIndex {
  byId: Map<string, RelPerson>;
  familyById: Map<string, RelFamily>;
  /** Các gia đình mà người này là vợ hoặc chồng, đã xếp (vợ/chồng cả trước). */
  familiesOf: Map<string, RelFamily[]>;
  /** Con của từng gia đình, đã xếp theo thứ tự con. */
  childrenOf: Map<string, RelPerson[]>;
}

export const yearOf = (d: string | null | undefined): string =>
  d ? d.slice(0, 4) : "";

/** Con thứ mấy → năm sinh → tên. Người không có thứ tự xếp sau. */
function compareSiblings(a: RelPerson, b: RelPerson): number {
  const ao = a.birth_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.birth_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  const ay = yearOf(a.birth_date) || "9999";
  const by = yearOf(b.birth_date) || "9999";
  if (ay !== by) return ay < by ? -1 : 1;
  return a.full_name.localeCompare(b.full_name, "vi");
}

function compareFamilies(a: RelFamily, b: RelFamily): number {
  const ao = a.spouse_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.spouse_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}

export function buildRelationsIndex(
  persons: RelPerson[],
  families: RelFamily[],
): RelationsIndex {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const familyById = new Map(families.map((f) => [f.id, f]));
  const familiesOf = new Map<string, RelFamily[]>();
  for (const f of families) {
    for (const pid of [f.husband_id, f.wife_id]) {
      if (!pid) continue;
      const list = familiesOf.get(pid) ?? [];
      list.push(f);
      familiesOf.set(pid, list);
    }
  }
  for (const list of familiesOf.values()) list.sort(compareFamilies);
  const childrenOf = new Map<string, RelPerson[]>();
  for (const p of persons) {
    if (!p.birth_family_id) continue;
    const list = childrenOf.get(p.birth_family_id) ?? [];
    list.push(p);
    childrenOf.set(p.birth_family_id, list);
  }
  for (const list of childrenOf.values()) list.sort(compareSiblings);
  return { byId, familyById, familiesOf, childrenOf };
}

export interface Parents {
  family: RelFamily | null;
  father: RelPerson | null;
  mother: RelPerson | null;
}

export function parentsOf(idx: RelationsIndex, id: string): Parents {
  const p = idx.byId.get(id);
  const family = p?.birth_family_id
    ? (idx.familyById.get(p.birth_family_id) ?? null)
    : null;
  return {
    family,
    father: family?.husband_id
      ? (idx.byId.get(family.husband_id) ?? null)
      : null,
    mother: family?.wife_id ? (idx.byId.get(family.wife_id) ?? null) : null,
  };
}

/** Dòng cha: cha, ông, cụ, kỵ… (tối đa `max` đời). Dừng khi không còn cha ghi nhận. */
export function paternalLine(
  idx: RelationsIndex,
  id: string,
  max = 15,
): RelPerson[] {
  const out: RelPerson[] = [];
  const seen = new Set([id]);
  let cur = id;
  while (out.length < max) {
    const { father } = parentsOf(idx, cur);
    if (!father || seen.has(father.id)) break;
    out.push(father);
    seen.add(father.id);
    cur = father.id;
  }
  return out;
}

export interface SpouseEntry {
  person: RelPerson;
  family: RelFamily;
}

export function spousesOf(idx: RelationsIndex, id: string): SpouseEntry[] {
  const out: SpouseEntry[] = [];
  for (const f of idx.familiesOf.get(id) ?? []) {
    const otherId = f.husband_id === id ? f.wife_id : f.husband_id;
    const other = otherId ? idx.byId.get(otherId) : undefined;
    if (other) out.push({ person: other, family: f });
  }
  return out;
}

/** Anh chị em ruột (cùng gia đình sinh ra), không gồm chính người đó. */
export function siblingsOf(idx: RelationsIndex, id: string): RelPerson[] {
  const p = idx.byId.get(id);
  if (!p?.birth_family_id) return [];
  return (idx.childrenOf.get(p.birth_family_id) ?? []).filter(
    (s) => s.id !== id,
  );
}

/** Con của người này qua mọi cuộc hôn nhân, kèm gia đình sinh ra chúng. */
export function childrenOf(
  idx: RelationsIndex,
  id: string,
): { person: RelPerson; family: RelFamily }[] {
  const out: { person: RelPerson; family: RelFamily }[] = [];
  for (const f of idx.familiesOf.get(id) ?? []) {
    for (const c of idx.childrenOf.get(f.id) ?? [])
      out.push({ person: c, family: f });
  }
  return out;
}

export interface DescendantRow {
  /** 1 = con, 2 = cháu, 3 = chắt, 4 = chít… */
  level: number;
  person: RelPerson;
  spouses: RelPerson[];
  father: RelPerson | null;
  mother: RelPerson | null;
}

/**
 * Mọi con cháu của một người, xếp theo đời (con → cháu → chắt…), trong từng đời giữ thứ tự
 * theo nhánh cha mẹ. `maxLevel` chặn họ rất đông / dữ liệu vòng lặp.
 */
export function descendantRows(
  idx: RelationsIndex,
  id: string,
  maxLevel = 12,
): DescendantRow[] {
  const rows: DescendantRow[] = [];
  const seen = new Set([id]);
  const walk = (pid: string, level: number) => {
    if (level > maxLevel) return;
    for (const { person } of childrenOf(idx, pid)) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      const { father, mother } = parentsOf(idx, person.id);
      rows.push({
        level,
        person,
        spouses: spousesOf(idx, person.id).map((s) => s.person),
        father,
        mother,
      });
      walk(person.id, level + 1);
    }
  };
  walk(id, 1);
  // Xếp ổn định theo đời: cùng đời giữ nguyên thứ tự duyệt (nhánh cha mẹ).
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.level - b.r.level || a.i - b.i)
    .map((x) => x.r);
}

/** Tên bậc con cháu: con, cháu, chắt, chít, rồi "thế hệ thứ N" (N tính từ người đang xem). */
export const levelName = (level: number): string => {
  switch (level) {
    case 1:
      return t`con`;
    case 2:
      return t`cháu`;
    case 3:
      return t`chắt`;
    case 4:
      return t`chít`;
    default:
      return t`thế hệ thứ ${level}`;
  }
};

/**
 * "4 con, 19 cháu, 3 chắt, 2 chít, 14 đời sau" — chỉ gọi tên đến chít, các đời xa hơn gộp
 * thành "đời sau" cho gọn. Rỗng nếu không có con cháu.
 */
export function descendantSummary(rows: DescendantRow[]): string {
  const counts = new Map<number, number>();
  let further = 0;
  for (const r of rows) {
    if (r.level <= 4) counts.set(r.level, (counts.get(r.level) ?? 0) + 1);
    else further += 1;
  }
  const parts = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, n]) => `${n} ${levelName(level)}`);
  if (further > 0) parts.push(t`${further} đời sau`);
  return parts.join(", ");
}

/** Nhãn dòng cha theo thứ bậc: cha, ông, cụ, kỵ, rồi "tiên tổ đời N". */
export function ancestorLabel(level: number): string {
  switch (level) {
    case 1:
      return t`Cha`;
    case 2:
      return t`Ông`;
    case 3:
      return t`Cụ`;
    case 4:
      return t`Kỵ`;
    default:
      return t`Tiên tổ (${level} đời trên)`;
  }
}

/** Toàn bộ nội dung "Tra cứu quan hệ" của một người — MỘT nguồn cho giao diện, CSV và PDF. */
export interface RelationsReport {
  focal: RelPerson;
  /** Đời hiển thị (đã trừ độ lệch đời của dòng họ). */
  generation: number | null;
  /** Dòng cha: cha, ông, cụ, kỵ… */
  line: RelPerson[];
  mother: RelPerson | null;
  spouses: RelPerson[];
  siblings: RelPerson[];
  fatherSiblings: RelPerson[];
  motherSiblings: RelPerson[];
  rows: DescendantRow[];
  /** "4 con, 19 cháu, 3 chắt…" */
  summary: string;
}

export function buildRelationsReport(
  idx: RelationsIndex,
  focal: RelPerson,
  genOffset: number,
): RelationsReport {
  const parents = parentsOf(idx, focal.id);
  const rows = descendantRows(idx, focal.id);
  return {
    focal,
    generation: focal.generation !== null ? focal.generation - genOffset : null,
    line: paternalLine(idx, focal.id),
    mother: parents.mother,
    spouses: spousesOf(idx, focal.id).map((s) => s.person),
    siblings: siblingsOf(idx, focal.id),
    fatherSiblings: parents.father ? siblingsOf(idx, parents.father.id) : [],
    motherSiblings: parents.mother ? siblingsOf(idx, parents.mother.id) : [],
    rows,
    summary: descendantSummary(rows),
  };
}

/** Nhãn "Mất": năm mất, "đã mất" nếu mất mà không rõ năm, "—" nếu còn sống / chưa rõ. */
export function deathLabel(p: RelPerson): string {
  return p.death_date ? yearOf(p.death_date) : p.is_living ? "—" : "đã mất";
}
