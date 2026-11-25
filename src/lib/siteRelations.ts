import type { ShareViewFamily, ShareViewPerson } from "@/lib/queries/share-view";

export interface PersonRelations {
  parents: ShareViewPerson[];
  spouses: ShareViewPerson[];
  children: ShareViewPerson[];
  siblings: ShareViewPerson[];
}

const byOrder = (a: ShareViewPerson, b: ShareViewPerson) => (a.birth_order ?? 999) - (b.birth_order ?? 999) || a.full_name.localeCompare(b.full_name, "vi");

/**
 * Quan hệ gần của một người, tính từ payload cây của link (đã che người còn sống):
 * cha mẹ (gia đình sinh ra), vợ/chồng (theo thứ tự `spouse_order`), con (sinh trong các gia đình của người đó), anh chị em ruột / cùng cha hoặc mẹ.
 * Người không có trong payload thì bị bỏ qua.
 */
export function personRelations(persons: ShareViewPerson[], families: ShareViewFamily[], personId: string): PersonRelations {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const me = byId.get(personId);
  const empty: PersonRelations = { parents: [], spouses: [], children: [], siblings: [] };
  if (!me) return empty;
  const pick = (ids: (string | null)[]) => ids.map((i) => (i ? byId.get(i) : undefined)).filter((p): p is ShareViewPerson => !!p);

  const birth = me.birth_family_id ? families.find((f) => f.id === me.birth_family_id) : undefined;
  const parents = birth ? pick([birth.husband_id, birth.wife_id]) : [];

  const own = families
    .filter((f) => f.husband_id === personId || f.wife_id === personId)
    .sort((a, b) => (a.spouse_order ?? 999) - (b.spouse_order ?? 999));
  const spouses = pick(own.map((f) => (f.husband_id === personId ? f.wife_id : f.husband_id)));
  const ownIds = new Set(own.map((f) => f.id));
  const children = persons.filter((p) => !!p.birth_family_id && ownIds.has(p.birth_family_id)).sort(byOrder);
  const siblings = me.birth_family_id ? persons.filter((p) => p.id !== personId && p.birth_family_id === me.birth_family_id).sort(byOrder) : [];
  return { parents, spouses, children, siblings };
}
