import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import {
  addChildToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { createPerson } from "@/lib/queries/persons";

import { createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

describe("queries: families & relationships", () => {
  let owner: TestUser;
  let clanId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Owner" });
    cleanup.push(owner.id);
    const r = await createClan({ name: "Family Test" }, owner.id, owner.client);
    clanId = r.id;
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("getPersonRelationships returns all-empty for a lone person", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Cô đơn", gender: "F" },
      owner.client,
    );

    const r = await getPersonRelationships(id, owner.client);
    expect(r.parents).toEqual([]);
    expect(r.spouses).toEqual([]);
    expect(r.children).toEqual([]);
  });

  it("findOrCreateFamily creates once, then returns the same id on second call", async () => {
    const husband = await createPerson(
      { clan_id: clanId, full_name: "Chồng", gender: "M" },
      owner.client,
    );
    const wife = await createPerson(
      { clan_id: clanId, full_name: "Vợ", gender: "F" },
      owner.client,
    );

    const first = await findOrCreateFamily(
      {
        clanId,
        partnerA: { id: husband.id, gender: "M" },
        partnerB: { id: wife.id, gender: "F" },
      },
      owner.client,
    );
    const second = await findOrCreateFamily(
      {
        clanId,
        partnerA: { id: wife.id, gender: "F" }, // partner order swapped
        partnerB: { id: husband.id, gender: "M" },
      },
      owner.client,
    );
    expect(first.id).toBe(second.id);
  });

  it("after creating a family + child, parents see each other and the child", async () => {
    const dad = await createPerson(
      { clan_id: clanId, full_name: "Bố", gender: "M", is_root: true },
      owner.client,
    );
    const mom = await createPerson(
      { clan_id: clanId, full_name: "Mẹ", gender: "F" },
      owner.client,
    );
    const family = await findOrCreateFamily(
      {
        clanId,
        partnerA: { id: dad.id, gender: "M" },
        partnerB: { id: mom.id, gender: "F" },
      },
      owner.client,
    );
    const child = await addChildToFamily(
      {
        clanId,
        family_id: family.id,
        full_name: "Con",
        gender: "M",
      },
      owner.client,
    );

    const dadRel = await getPersonRelationships(dad.id, owner.client);
    expect(dadRel.spouses).toHaveLength(1);
    expect(dadRel.spouses[0].full_name).toBe("Mẹ");
    expect(dadRel.spouses[0].family_id).toBe(family.id);
    expect(dadRel.children).toHaveLength(1);
    expect(dadRel.children[0].full_name).toBe("Con");

    const momRel = await getPersonRelationships(mom.id, owner.client);
    expect(momRel.spouses.map((s) => s.id)).toEqual([dad.id]);
    expect(momRel.children.map((c) => c.id)).toEqual([child.id]);

    const childRel = await getPersonRelationships(child.id, owner.client);
    expect(childRel.parents.map((p) => p.id).sort()).toEqual(
      [dad.id, mom.id].sort(),
    );
  });

  it("addChildToFamily triggers recompute_generation (child gets parent_gen + 1)", async () => {
    const root = await createPerson(
      { clan_id: clanId, full_name: "Tổ phụ", gender: "M", is_root: true },
      owner.client,
    );
    const fam = await findOrCreateFamily(
      {
        clanId,
        partnerA: { id: root.id, gender: "M" },
        partnerB: null,
      },
      owner.client,
    );
    const son = await addChildToFamily(
      { clanId, family_id: fam.id, full_name: "Con trai", gender: "M" },
      owner.client,
    );

    // Wait a tick for the trigger (it runs synchronously in the same txn)
    const { data: sonRow } = await owner.client
      .from("persons")
      .select("generation")
      .eq("id", son.id)
      .single();
    expect(sonRow?.generation).toBe(2);
  });
});
