import { afterAll, describe, expect, it } from "vitest";

import {
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
} from "../supabase-helpers";

describe("RLS + triggers: limits", () => {
  const cleanupIds: string[] = [];

  afterAll(async () => {
    for (const id of cleanupIds) {
      await deleteUser(id);
    }
  });

  it("max_clans blocks second clan for default user (max=1)", async () => {
    const user = await createTestUser({ displayName: "1-clan user" });
    cleanupIds.push(user.id);

    await createTestClan(user, { name: "First" });

    // Second insert should hit enforce_max_clans
    const { error } = await user.client.from("clans").insert({
      name: "Second",
      owner_id: user.id,
    });
    expect(error?.message).toMatch(/max_clans/i);
  });

  it("max_clans allows N clans when raised by platform admin", async () => {
    const user = await createTestUser({ displayName: "3-clan user", maxClans: 3 });
    cleanupIds.push(user.id);

    await createTestClan(user, { name: "C1" });
    await createTestClan(user, { name: "C2" });
    await createTestClan(user, { name: "C3" });

    const { error } = await user.client.from("clans").insert({
      name: "C4",
      owner_id: user.id,
    });
    expect(error?.message).toMatch(/max_clans/i);
  });

  it("max_persons blocks insert at limit", async () => {
    const user = await createTestUser({ displayName: "Limit owner" });
    cleanupIds.push(user.id);
    const clanId = await createTestClan(user, { maxPersons: 2 });

    await user.client.from("persons").insert({ clan_id: clanId, full_name: "P1", gender: "M" });
    await user.client.from("persons").insert({ clan_id: clanId, full_name: "P2", gender: "F" });

    const { error } = await user.client.from("persons").insert({
      clan_id: clanId,
      full_name: "P3",
      gender: "M",
    });
    expect(error?.message).toMatch(/max_persons/i);
  });

  it("max_users blocks 3rd member when limit=2", async () => {
    const owner = await createTestUser({ displayName: "Owner" });
    const member = await createTestUser({ displayName: "M1" });
    const blocked = await createTestUser({ displayName: "Blocked" });
    cleanupIds.push(owner.id, member.id, blocked.id);

    // Create clan with limit 2; owner is already member #1
    const clanId = await createTestClan(owner, { maxUsers: 2 });

    // Add 2nd member (succeeds; owner+this = 2)
    await addMember(clanId, member, "editor");

    // 3rd should fail
    const { error } = await owner.client.from("clan_members").insert({
      clan_id: clanId,
      user_id: blocked.id,
      role: "viewer",
    });
    expect(error?.message).toMatch(/max_users/i);
  });
});
