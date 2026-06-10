import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

describe("RLS: feedback table", () => {
  let admin: TestUser;
  let user: TestUser;
  let otherUser: TestUser;

  beforeAll(async () => {
    admin = await createTestUser({
      displayName: "FeedbackAdmin",
      isPlatformAdmin: true,
    });
    user = await createTestUser({ displayName: "FeedbackUser" });
    otherUser = await createTestUser({ displayName: "FeedbackOther" });

    // Clean slate — these tests assert exact row counts so prior runs
    // shouldn't bleed in.
    await adminClient().from("feedback").delete().neq("id", "");
  });

  afterAll(async () => {
    await deleteUser(admin.id);
    await deleteUser(user.id);
    await deleteUser(otherUser.id);
  });

  // ─── INSERT ────────────────────────────────────────────────────

  it("anon CAN insert feedback (user_id null)", async () => {
    const anon = anonClient();
    const { error } = await anon.from("feedback").insert({
      message: "Anon feedback — tôi không đăng nhập được",
    });
    expect(error).toBeNull();
  });

  it("authenticated user CAN insert with own user_id", async () => {
    const { error } = await user.client.from("feedback").insert({
      user_id: user.id,
      message: "Authed feedback từ user thường",
      contact: "user@example.com",
    });
    expect(error).toBeNull();
  });

  it("authenticated user CAN insert with user_id null (acts as guest)", async () => {
    const { error } = await user.client.from("feedback").insert({
      message: "Authed user gửi ẩn danh",
    });
    expect(error).toBeNull();
  });

  it("authenticated user CANNOT spoof another user's user_id", async () => {
    const { error } = await user.client.from("feedback").insert({
      user_id: otherUser.id,
      message: "Spoof attempt",
    });
    expect(error).not.toBeNull();
    // RLS check failure surfaces as 42501 / "violates row-level security
    // policy" depending on supabase version. Either string contains
    // "row-level security" or the code is 42501.
    expect(
      error?.code === "42501" ||
        /row-level security/i.test(error?.message ?? ""),
    ).toBe(true);
  });

  // ─── Constraints ───────────────────────────────────────────────

  it("rejects empty message", async () => {
    const { error } = await anonClient().from("feedback").insert({
      message: "   ",
    });
    expect(error).not.toBeNull();
  });

  it("rejects message > 5000 chars", async () => {
    const huge = "x".repeat(5001);
    const { error } = await anonClient().from("feedback").insert({
      message: huge,
    });
    expect(error).not.toBeNull();
  });

  it("rejects contact > 200 chars", async () => {
    const longContact = "x".repeat(201);
    const { error } = await anonClient().from("feedback").insert({
      message: "ok",
      contact: longContact,
    });
    expect(error).not.toBeNull();
  });

  // ─── SELECT ────────────────────────────────────────────────────

  it("anon CANNOT select any feedback", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("feedback").select("id");
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("regular user CANNOT select feedback (not even their own)", async () => {
    const { data, error } = await user.client
      .from("feedback")
      .select("id, user_id");
    if (error) {
      expect(error).toBeTruthy();
    } else {
      // RLS silently returns 0 rows for non-admins, including for the
      // user's own submissions. Privacy: feedback isn't a self-service
      // archive.
      expect(data).toEqual([]);
    }
  });

  it("platform admin CAN select all feedback", async () => {
    const { data, error } = await admin.client
      .from("feedback")
      .select("id, message, user_id");
    expect(error).toBeNull();
    // We inserted 3 valid rows above (anon, authed-self, authed-anon).
    // Constraint-failing inserts didn't land, so this should be >= 3.
    expect((data ?? []).length).toBeGreaterThanOrEqual(3);
  });

  // ─── UPDATE / DELETE ───────────────────────────────────────────

  it("regular user CANNOT update or delete their own feedback", async () => {
    // Find a row this user inserted via the admin client (since they
    // can't SELECT). Then try to update / delete from the user client.
    const { data: rows } = await adminClient()
      .from("feedback")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    const rowId = rows?.[0]?.id;
    expect(rowId).toBeTruthy();

    const { error: updErr, count: updCount } = await user.client
      .from("feedback")
      .update({ message: "tampered" }, { count: "exact" })
      .eq("id", rowId!);
    // No UPDATE policy → either error or affected count = 0 silently.
    if (updErr) {
      expect(updErr).toBeTruthy();
    } else {
      expect(updCount ?? 0).toBe(0);
    }

    const { error: delErr, count: delCount } = await user.client
      .from("feedback")
      .delete({ count: "exact" })
      .eq("id", rowId!);
    if (delErr) {
      expect(delErr).toBeTruthy();
    } else {
      expect(delCount ?? 0).toBe(0);
    }
  });
});
