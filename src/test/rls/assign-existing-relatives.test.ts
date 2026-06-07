import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Cycle guards on the two "link existing" RPCs:
 *   - assign_existing_spouse: spouse can't be ancestor OR descendant.
 *   - assign_existing_parent: parent can't be a descendant ("ông nội
 *     là con của cháu" case explicitly called out).
 */
describe("RLS: assign_existing_spouse + assign_existing_parent", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let clanId: string;
  let otherClanId: string;

  let grandpa: string;
  let dad: string;
  let mum: string;
  let kid: string;
  let outsider: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Owner" });
    stranger = await createTestUser({ displayName: "Stranger" });
    clanId = await createTestClan(owner, { name: "Họ chính" });
    otherClanId = await createTestClan(stranger, { name: "Họ khác" });

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
    grandpa = await ins("Grandpa", "M");
    dad = await ins("Dad", "M");
    mum = await ins("Mum", "F");
    kid = await ins("Kid", "M");
    outsider = await ins("Outsider", "F", otherClanId);

    // Family grandpa+? → dad as child
    const f1 = await admin
      .from("families")
      .insert({ clan_id: clanId, husband_id: grandpa, wife_id: null })
      .select("id")
      .single();
    await admin
      .from("persons")
      .update({ birth_family_id: f1.data!.id })
      .eq("id", dad);

    // Family dad + mum → kid
    const f2 = await admin
      .from("families")
      .insert({ clan_id: clanId, husband_id: dad, wife_id: mum })
      .select("id")
      .single();
    await admin
      .from("persons")
      .update({ birth_family_id: f2.data!.id })
      .eq("id", kid);
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(stranger.id);
  });

  // ── assign_existing_spouse ───────────────────────────────────────

  it("anon refused on spouse RPC", async () => {
    const { error } = await anonClient().rpc("assign_existing_spouse", {
      p_person_id: dad,
      p_spouse_id: mum,
    });
    expect(error).not.toBeNull();
  });

  it("stranger refused on spouse RPC", async () => {
    const { error } = await stranger.client.rpc("assign_existing_spouse", {
      p_person_id: dad,
      p_spouse_id: mum,
    });
    expect(error).not.toBeNull();
  });

  it("cross-clan spouse refused", async () => {
    const { error } = await owner.client.rpc("assign_existing_spouse", {
      p_person_id: dad,
      p_spouse_id: outsider,
    });
    expect(error).not.toBeNull();
  });

  it("same-gender refused", async () => {
    const m2 = await adminClient()
      .from("persons")
      .insert({ clan_id: clanId, full_name: "Man2", gender: "M" })
      .select("id")
      .single();
    const { error } = await owner.client.rpc("assign_existing_spouse", {
      p_person_id: dad,
      p_spouse_id: m2.data!.id,
    });
    expect(error).not.toBeNull();
  });

  it("spouse-as-ancestor refused (cycle up)", async () => {
    // Try to marry kid (M) to grandpa's wife — wait grandpa is male
    // and we already validated same-gender. Use a different setup:
    // try to marry kid to grandpa directly — different genders OK if
    // we set up an F ancestor.
    const gma = await adminClient()
      .from("persons")
      .insert({ clan_id: clanId, full_name: "Grandma", gender: "F" })
      .select("id")
      .single();
    // Put Grandma as wife in grandpa's family — making her dad's mum.
    const grandpaFam = await adminClient()
      .from("families")
      .select("id")
      .eq("husband_id", grandpa)
      .single();
    await adminClient()
      .from("families")
      .update({ wife_id: gma.data!.id })
      .eq("id", grandpaFam.data!.id);

    const { error } = await owner.client.rpc("assign_existing_spouse", {
      p_person_id: kid,
      p_spouse_id: gma.data!.id,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/tổ tiên/i);
  });

  it("spouse-as-descendant refused (cycle down)", async () => {
    const niece = await adminClient()
      .from("persons")
      .insert({ clan_id: clanId, full_name: "Niece", gender: "F" })
      .select("id")
      .single();
    const kidFam = await adminClient()
      .from("families")
      .insert({ clan_id: clanId, husband_id: kid, wife_id: null })
      .select("id")
      .single();
    await adminClient()
      .from("persons")
      .update({ birth_family_id: kidFam.data!.id })
      .eq("id", niece.data!.id);

    // Trying to marry dad to his own granddaughter (kid's daughter) →
    // niece is a descendant of dad.
    const { error } = await owner.client.rpc("assign_existing_spouse", {
      p_person_id: dad,
      p_spouse_id: niece.data!.id,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/con cháu/i);
  });

  it("happy path spouse: returns family id", async () => {
    // dad + mum already paired in seed → RPC returns the existing id.
    const { data, error } = await owner.client.rpc("assign_existing_spouse", {
      p_person_id: dad,
      p_spouse_id: mum,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
  });

  // ── assign_existing_parent ───────────────────────────────────────

  it("anon refused on parent RPC", async () => {
    const { error } = await anonClient().rpc("assign_existing_parent", {
      p_person_id: kid,
      p_parent_id: dad,
    });
    expect(error).not.toBeNull();
  });

  it("cross-clan parent refused", async () => {
    const { error } = await owner.client.rpc("assign_existing_parent", {
      p_person_id: kid,
      p_parent_id: outsider,
    });
    expect(error).not.toBeNull();
  });

  it("descendant-as-parent refused (the ông-nội-là-con-của-cháu case)", async () => {
    const { error } = await owner.client.rpc("assign_existing_parent", {
      p_person_id: grandpa,
      p_parent_id: kid,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/vòng lặp|con cháu/i);
  });

  it("self-as-parent refused", async () => {
    const { error } = await owner.client.rpc("assign_existing_parent", {
      p_person_id: dad,
      p_parent_id: dad,
    });
    expect(error).not.toBeNull();
  });

  it("happy path parent: orphan gets a father", async () => {
    const orphan = await adminClient()
      .from("persons")
      .insert({ clan_id: clanId, full_name: "Orphan", gender: "M" })
      .select("id")
      .single();
    const { data, error } = await owner.client.rpc("assign_existing_parent", {
      p_person_id: orphan.data!.id,
      p_parent_id: dad,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");

    const { data: updated } = await owner.client
      .from("persons")
      .select("birth_family_id")
      .eq("id", orphan.data!.id)
      .single();
    expect(updated?.birth_family_id).toBe(data);
  });
});
