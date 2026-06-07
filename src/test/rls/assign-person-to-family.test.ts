import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  adminClient,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * assign_person_to_family — link an existing clan member as child of
 * a family. Validations covered:
 *   - anon refused
 *   - non-editor refused
 *   - cross-clan refused
 *   - self-as-child refused
 *   - ancestor-cycle refused
 *   - happy path: birth_family_id flips to target.
 */
describe("RLS: assign_person_to_family", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let clanId: string;
  let otherClanId: string;
  let dad: string;
  let mum: string;
  let kid: string;
  let grandkid: string;
  let stranger_kid: string;
  let dadMumFamilyId: string;
  let dadSoloFamilyId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Owner" });
    viewer = await createTestUser({ displayName: "Viewer" });
    stranger = await createTestUser({ displayName: "Stranger" });
    clanId = await createTestClan(owner, { name: "Họ test" });
    otherClanId = await createTestClan(stranger, { name: "Họ khác" });
    await addMember(clanId, viewer, "viewer");

    const admin = adminClient();
    const ins = async (
      name: string,
      gender: "M" | "F",
      cid = clanId,
    ): Promise<string> => {
      const { data, error } = await admin
        .from("persons")
        .insert({ clan_id: cid, full_name: name, gender, is_root: false })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message);
      return data.id;
    };
    dad = await ins("Dad", "M");
    mum = await ins("Mum", "F");
    kid = await ins("Kid", "M");
    grandkid = await ins("Grandkid", "F");
    stranger_kid = await ins("Outsider", "M", otherClanId);

    // Family: dad + mum
    const fam1 = await admin
      .from("families")
      .insert({ clan_id: clanId, husband_id: dad, wife_id: mum })
      .select("id")
      .single();
    if (fam1.error || !fam1.data) throw new Error(fam1.error?.message);
    dadMumFamilyId = fam1.data.id;

    // Family: dad alone (the orphan-style family to migrate from)
    const fam2 = await admin
      .from("families")
      .insert({ clan_id: clanId, husband_id: dad, wife_id: null })
      .select("id")
      .single();
    if (fam2.error || !fam2.data) throw new Error(fam2.error?.message);
    dadSoloFamilyId = fam2.data.id;

    // Set kid as child of the solo family so we can reassign.
    await admin
      .from("persons")
      .update({ birth_family_id: dadSoloFamilyId })
      .eq("id", kid);

    // Set grandkid's birth_family to a family where kid is a parent
    // — used for the ancestor-cycle test.
    const fam3 = await admin
      .from("families")
      .insert({ clan_id: clanId, husband_id: kid, wife_id: null })
      .select("id")
      .single();
    if (fam3.error || !fam3.data) throw new Error(fam3.error?.message);
    await admin
      .from("persons")
      .update({ birth_family_id: fam3.data.id })
      .eq("id", grandkid);
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(viewer.id);
    await deleteUser(stranger.id);
  });

  it("anon refused", async () => {
    const { error } = await anonClient().rpc("assign_person_to_family", {
      p_person_id: kid,
      p_family_id: dadMumFamilyId,
    });
    expect(error).not.toBeNull();
  });

  it("viewer (no edit) refused", async () => {
    const { error } = await viewer.client.rpc("assign_person_to_family", {
      p_person_id: kid,
      p_family_id: dadMumFamilyId,
    });
    expect(error).not.toBeNull();
  });

  it("stranger (no clan access) refused", async () => {
    const { error } = await stranger.client.rpc("assign_person_to_family", {
      p_person_id: kid,
      p_family_id: dadMumFamilyId,
    });
    expect(error).not.toBeNull();
  });

  it("cross-clan: person from other clan refused", async () => {
    const { error } = await owner.client.rpc("assign_person_to_family", {
      p_person_id: stranger_kid,
      p_family_id: dadMumFamilyId,
    });
    expect(error).not.toBeNull();
  });

  it("self-as-child refused (person is a parent of the family)", async () => {
    const { error } = await owner.client.rpc("assign_person_to_family", {
      p_person_id: dad,
      p_family_id: dadMumFamilyId,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/cha\/mẹ/i);
  });

  it("ancestor cycle refused — assigning ancestor as descendant", async () => {
    // Try to make `dad` a child of his grandchild's family.
    const grandFam = await adminClient()
      .from("families")
      .select("id")
      .eq("husband_id", kid)
      .single();
    expect(grandFam.error).toBeNull();
    const { error } = await owner.client.rpc("assign_person_to_family", {
      p_person_id: dad,
      p_family_id: grandFam.data!.id,
    });
    expect(error).not.toBeNull();
  });

  it("happy path: reassign kid from solo family to dad+mum", async () => {
    const { error } = await owner.client.rpc("assign_person_to_family", {
      p_person_id: kid,
      p_family_id: dadMumFamilyId,
    });
    expect(error).toBeNull();

    const { data } = await owner.client
      .from("persons")
      .select("birth_family_id")
      .eq("id", kid)
      .maybeSingle();
    expect(data?.birth_family_id).toBe(dadMumFamilyId);
  });
});
