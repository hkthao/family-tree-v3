import { afterAll, describe, expect, it } from "vitest";

import {
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
} from "../supabase-helpers";

describe("RLS + partial unique: event_subscriptions", () => {
  const cleanup: string[] = [];

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("non-member cannot subscribe to a clan's events", async () => {
    const owner = await createTestUser({ displayName: "Owner" });
    const outsider = await createTestUser({ displayName: "Outsider" });
    cleanup.push(owner.id, outsider.id);

    const clanId = await createTestClan(owner);

    const { error } = await outsider.client.from("event_subscriptions").insert({
      clan_id: clanId,
      user_id: outsider.id,
      scope: "clan",
    });
    expect(error).not.toBeNull();
  });

  it("member can subscribe to clan-scope once; duplicate blocked by partial unique", async () => {
    const owner = await createTestUser({ displayName: "Owner2" });
    cleanup.push(owner.id);
    const clanId = await createTestClan(owner);

    const first = await owner.client.from("event_subscriptions").insert({
      clan_id: clanId,
      user_id: owner.id,
      scope: "clan",
    });
    expect(first.error).toBeNull();

    const second = await owner.client.from("event_subscriptions").insert({
      clan_id: clanId,
      user_id: owner.id,
      scope: "clan",
    });
    expect(second.error?.message).toMatch(/unique|duplicate/i);
  });

  it("user cannot insert subscription on someone else's behalf", async () => {
    const owner = await createTestUser({ displayName: "Owner3" });
    const other = await createTestUser({ displayName: "Other" });
    cleanup.push(owner.id, other.id);
    const clanId = await createTestClan(owner);
    await addMember(clanId, other, "viewer");

    // owner tries to subscribe `other`
    const { error } = await owner.client.from("event_subscriptions").insert({
      clan_id: clanId,
      user_id: other.id,
      scope: "clan",
    });
    expect(error).not.toBeNull();
  });

  it("user sees only their own subscriptions", async () => {
    const a = await createTestUser({ displayName: "SubA" });
    const b = await createTestUser({ displayName: "SubB" });
    cleanup.push(a.id, b.id);

    const clanA = await createTestClan(a);
    await addMember(clanA, b, "viewer");

    await a.client.from("event_subscriptions").insert({
      clan_id: clanA,
      user_id: a.id,
      scope: "clan",
    });
    await b.client.from("event_subscriptions").insert({
      clan_id: clanA,
      user_id: b.id,
      scope: "clan",
    });

    const { data: subsA } = await a.client.from("event_subscriptions").select("user_id");
    const { data: subsB } = await b.client.from("event_subscriptions").select("user_id");
    expect(subsA?.every((s) => s.user_id === a.id)).toBe(true);
    expect(subsB?.every((s) => s.user_id === b.id)).toBe(true);
  });
});
