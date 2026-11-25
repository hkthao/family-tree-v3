import { describe, expect, it } from "vitest";

import type { ShareViewFamily, ShareViewPerson } from "@/lib/queries/share-view";
import { personRelations } from "@/lib/siteRelations";
import { subtreeScope } from "../../../supabase/functions/share-view/scope";

const P = (id: string, over: Partial<ShareViewPerson> = {}) =>
  ({ id, full_name: id.toUpperCase(), gender: "M", is_living: false, is_root: false, generation: 1, branch_id: null, birth_family_id: null, birth_order: null, birth_date: null, birth_date_precision: null, death_date: null, death_date_precision: null, photo_url: null, ...over }) as ShareViewPerson;
const F = (id: string, h: string | null, w: string | null, order: number | null = null): ShareViewFamily => ({ id, husband_id: h, wife_id: w, spouse_order: order, created_at: null });

describe("personRelations", () => {
  // ông(a) + bà(b) → con c, d ; c + e (vợ thứ 2) và c + f (vợ thứ 1) → con g
  const persons = [P("a"), P("b"), P("c", { birth_family_id: "f0", birth_order: 1 }), P("d", { birth_family_id: "f0", birth_order: 2 }), P("e"), P("f"), P("g", { birth_family_id: "f2" })];
  const families = [F("f0", "a", "b"), F("f1", "c", "e", 2), F("f2", "c", "f", 1)];

  it("cha mẹ, vợ/chồng theo spouse_order, con, anh chị em", () => {
    const r = personRelations(persons, families, "c");
    expect(r.parents.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.spouses.map((p) => p.id)).toEqual(["f", "e"]); // vợ thứ 1 trước vợ thứ 2
    expect(r.children.map((p) => p.id)).toEqual(["g"]);
    expect(r.siblings.map((p) => p.id)).toEqual(["d"]);
  });

  it("người không có quan hệ / không có trong payload → rỗng", () => {
    expect(personRelations(persons, families, "e").siblings).toEqual([]);
    expect(personRelations(persons, families, "zzz")).toEqual({ parents: [], spouses: [], children: [], siblings: [] });
  });

  it("bỏ qua người không có trong payload (đã bị che / ngoài phạm vi link)", () => {
    const r = personRelations(persons.filter((p) => p.id !== "b"), families, "c");
    expect(r.parents.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("subtreeScope (phạm vi link cây con)", () => {
  const ps = [{ id: "root", birth_family_id: null }, { id: "kid", birth_family_id: "f1" }, { id: "wife", birth_family_id: null }, { id: "grand", birth_family_id: "f2" }, { id: "other", birth_family_id: null }];
  const fs = [{ id: "f1", husband_id: "root", wife_id: "wife" }, { id: "f2", husband_id: "kid", wife_id: null }];

  it("người gốc + vợ/chồng + mọi con cháu, không kéo người ngoài", () => {
    const { kept, familiesKept } = subtreeScope(ps, fs, "root");
    expect([...kept].sort()).toEqual(["grand", "kid", "root", "wife"]);
    expect([...familiesKept].sort()).toEqual(["f1", "f2"]);
  });

  it("gốc ở giữa chỉ lấy nhánh dưới nó", () => {
    expect([...subtreeScope(ps, fs, "kid").kept].sort()).toEqual(["grand", "kid"]);
  });
});
