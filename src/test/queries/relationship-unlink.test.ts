import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import {
  assignExistingParent,
  assignExistingSpouse,
  assignPersonToFamily,
  getPersonRelationships,
  removeChildLink,
  removeParentLink,
  removeSpouseLink,
} from "@/lib/queries/families";
import { createPerson } from "@/lib/queries/persons";

import { createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

describe("queries: gỡ liên kết quan hệ nhập nhầm", () => {
  let owner: TestUser;
  let clanId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "UnlinkOwner" });
    clanId = (await createClan({ name: "Unlink Clan" }, owner.id, owner.client)).id;
  });
  afterAll(async () => {
    await deleteUser(owner.id);
  });

  const mk = async (name: string, gender: "M" | "F") =>
    (await createPerson({ clan_id: clanId, full_name: name, gender }, owner.client)).id;

  it("gỡ cha rồi gỡ mẹ: người vẫn còn, hết liên kết cha mẹ", async () => {
    const [kid, dad, mom] = [await mk("Con", "M"), await mk("Cha", "M"), await mk("Mẹ", "F")];
    await assignExistingParent(kid, dad, owner.client);
    await assignExistingParent(kid, mom, owner.client);
    expect((await getPersonRelationships(kid, owner.client)).parents).toHaveLength(2);

    await removeParentLink(kid, dad, owner.client);
    expect((await getPersonRelationships(kid, owner.client)).parents.map((p) => p.full_name)).toEqual(["Mẹ"]);

    await removeParentLink(kid, mom, owner.client);
    expect((await getPersonRelationships(kid, owner.client)).parents).toEqual([]);
    expect((await getPersonRelationships(dad, owner.client)).children).toEqual([]);
  });

  it("gỡ vợ/chồng chưa có con → xoá hôn nhân", async () => {
    const [h, w] = [await mk("Chồng", "M"), await mk("Vợ", "F")];
    await assignExistingSpouse(h, w, owner.client);
    const rel = await getPersonRelationships(h, owner.client);
    expect(rel.spouses).toHaveLength(1);
    await removeSpouseLink(rel.spouses[0].family_id, h, owner.client);
    expect((await getPersonRelationships(h, owner.client)).spouses).toEqual([]);
    expect((await getPersonRelationships(w, owner.client)).spouses).toEqual([]);
  });

  it("gỡ vợ/chồng đã có con → con vẫn thuộc người còn lại; gỡ con thì hết liên kết", async () => {
    const [h, w, c] = [await mk("Chồng2", "M"), await mk("Vợ2", "F"), await mk("Con2", "M")];
    await assignExistingSpouse(h, w, owner.client);
    const famId = (await getPersonRelationships(h, owner.client)).spouses[0].family_id;
    await assignPersonToFamily(c, famId, owner.client);
    await removeSpouseLink(famId, h, owner.client);
    const after = await getPersonRelationships(h, owner.client);
    expect(after.spouses).toEqual([]);
    expect(after.children.map((x) => x.full_name)).toEqual(["Con2"]);

    await removeChildLink(c, owner.client);
    expect((await getPersonRelationships(h, owner.client)).children).toEqual([]);
  });
});
