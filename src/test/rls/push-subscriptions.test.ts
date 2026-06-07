import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * push_subscriptions are owner-only: each user reads/writes their own
 * rows, never anyone else's. Edge Function dispatch uses service_role
 * to bypass — not tested here.
 */
describe("RLS: push_subscriptions", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser({ displayName: "Push A" });
    userB = await createTestUser({ displayName: "Push B" });
  });

  afterAll(async () => {
    await deleteUser(userA.id);
    await deleteUser(userB.id);
  });

  it("anon cannot read subscriptions", async () => {
    const { data, error } = await anonClient()
      .from("push_subscriptions")
      .select("id");
    // Anon table grants are revoked → RLS denies or returns []
    expect(error || (data ?? []).length === 0).toBeTruthy();
  });

  it("upsert_my_push_subscription creates row tied to caller", async () => {
    const { data: id, error } = await userA.client.rpc(
      "upsert_my_push_subscription",
      {
        p_endpoint: "https://example.push/test-a",
        p_p256dh: "x".repeat(20),
        p_auth: "y".repeat(20),
        p_user_agent: "VitestUA",
      },
    );
    expect(error).toBeNull();
    expect(typeof id).toBe("string");

    const { data: rows } = await userA.client
      .from("push_subscriptions")
      .select("user_id, endpoint")
      .eq("endpoint", "https://example.push/test-a");
    expect(rows).toHaveLength(1);
    expect(rows?.[0].user_id).toBe(userA.id);
  });

  it("upsert is idempotent on endpoint", async () => {
    // First insert
    await userA.client.rpc("upsert_my_push_subscription", {
      p_endpoint: "https://example.push/repeat",
      p_p256dh: "k1".repeat(15),
      p_auth: "a1".repeat(15),
      p_user_agent: "first",
    });
    // Second call with new keys — should UPDATE not INSERT
    await userA.client.rpc("upsert_my_push_subscription", {
      p_endpoint: "https://example.push/repeat",
      p_p256dh: "k2".repeat(15),
      p_auth: "a2".repeat(15),
      p_user_agent: "second",
    });
    const { data: rows } = await userA.client
      .from("push_subscriptions")
      .select("id, user_agent")
      .eq("endpoint", "https://example.push/repeat");
    expect(rows).toHaveLength(1);
    expect(rows?.[0].user_agent).toBe("second");
  });

  it("user B cannot SELECT user A's subscriptions", async () => {
    const { data } = await userB.client
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userA.id);
    expect(data).toEqual([]);
  });

  it("user B cannot INSERT a row with user_id pointing at user A", async () => {
    const { error } = await userB.client.from("push_subscriptions").insert({
      user_id: userA.id,
      endpoint: "https://example.push/forged",
      p256dh: "z".repeat(20),
      auth: "w".repeat(20),
    });
    expect(error).not.toBeNull();
  });

  it("user B cannot DELETE user A's subscription", async () => {
    const { error, data } = await userB.client
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", "https://example.push/test-a")
      .select();
    // RLS makes the row invisible to userB → delete returns no rows but
    // also no error.
    expect(data ?? []).toEqual([]);
    expect(error ?? null).toBeNull();

    const { data: still } = await userA.client
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", "https://example.push/test-a");
    expect(still ?? []).toHaveLength(1);
  });

  it("delete_my_push_subscription removes the caller's row only", async () => {
    const { error } = await userA.client.rpc("delete_my_push_subscription", {
      p_endpoint: "https://example.push/test-a",
    });
    expect(error).toBeNull();

    const { data: gone } = await userA.client
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", "https://example.push/test-a");
    expect(gone ?? []).toEqual([]);
  });

  it("anon cannot call upsert_my_push_subscription", async () => {
    const { error } = await anonClient().rpc("upsert_my_push_subscription", {
      p_endpoint: "https://example.push/anon",
      p_p256dh: "x".repeat(20),
      p_auth: "y".repeat(20),
    });
    expect(error).not.toBeNull();
  });

  it("profiles.notify_via_push is owner-updatable", async () => {
    const { error } = await userA.client
      .from("profiles")
      .update({ notify_via_push: true })
      .eq("id", userA.id);
    expect(error).toBeNull();

    const { data } = await userA.client
      .from("profiles")
      .select("notify_via_push")
      .eq("id", userA.id)
      .maybeSingle();
    expect(data?.notify_via_push).toBe(true);
  });
});
