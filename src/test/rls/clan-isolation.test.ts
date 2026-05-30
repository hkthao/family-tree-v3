import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Clan A's data must NOT be visible to clan B's users, regardless of role.
 * This is the most important RLS guarantee — a leak here = privacy breach.
 */
describe("RLS: clan isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let clanA: string;
  let clanB: string;
  let personInA: string;

  beforeAll(async () => {
    userA = await createTestUser({ displayName: "Owner A" });
    userB = await createTestUser({ displayName: "Owner B" });

    clanA = await createTestClan(userA, { name: "Họ A" });
    clanB = await createTestClan(userB, { name: "Họ B" });

    const { data, error } = await userA.client
      .from("persons")
      .insert({
        clan_id: clanA,
        full_name: "Nguyễn Văn A",
        gender: "M",
        is_root: true,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed person failed: ${error?.message}`);
    personInA = data.id;
  });

  afterAll(async () => {
    await deleteUser(userA.id);
    await deleteUser(userB.id);
  });

  it("user B cannot SELECT persons from clan A", async () => {
    const { data } = await userB.client.from("persons").select("id").eq("clan_id", clanA);
    expect(data).toEqual([]);
  });

  it("user B cannot SELECT clan A row itself", async () => {
    const { data } = await userB.client.from("clans").select("id").eq("id", clanA);
    expect(data).toEqual([]);
  });

  it("user B cannot SELECT clan A's members", async () => {
    const { data } = await userB.client
      .from("clan_members")
      .select("id")
      .eq("clan_id", clanA);
    expect(data).toEqual([]);
  });

  it("user B cannot INSERT a person into clan A", async () => {
    const { error } = await userB.client.from("persons").insert({
      clan_id: clanA,
      full_name: "Intruder",
      gender: "M",
    });
    expect(error).not.toBeNull();
  });

  it("user B cannot UPDATE person in clan A", async () => {
    const { error, data } = await userB.client
      .from("persons")
      .update({ full_name: "Hacked" })
      .eq("id", personInA)
      .select();
    // RLS hides the row, so the update silently affects 0 rows (no error).
    // We assert the actual data is unchanged.
    expect(data ?? []).toEqual([]);
    expect(error).toBeNull();

    // Verify A still sees original name
    const { data: stillA } = await userA.client
      .from("persons")
      .select("full_name")
      .eq("id", personInA)
      .single();
    expect(stillA?.full_name).toBe("Nguyễn Văn A");
  });

  it("user B cannot DELETE person in clan A", async () => {
    const { data } = await userB.client.from("persons").delete().eq("id", personInA).select();
    expect(data ?? []).toEqual([]);

    const { data: stillA } = await userA.client
      .from("persons")
      .select("id")
      .eq("id", personInA)
      .single();
    expect(stillA?.id).toBe(personInA);
  });

  it("user A still sees their own clan + persons", async () => {
    const { data: clan } = await userA.client.from("clans").select("id").eq("id", clanA).single();
    expect(clan?.id).toBe(clanA);

    const { data: persons } = await userA.client
      .from("persons")
      .select("id")
      .eq("clan_id", clanA);
    expect(persons?.map((p) => p.id)).toContain(personInA);
  });

  it("ignore unused", () => {
    // clanB and addMember are imported for type-checking sake when expanding tests.
    expect(clanB).toBeTruthy();
    expect(typeof addMember).toBe("function");
  });
});
