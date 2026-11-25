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

  it("anon can NOT insert directly (khách đi qua edge function feedback-submit)", async () => {
    const { error } = await anonClient().from("feedback").insert({
      message: "Anon feedback — tôi không đăng nhập được",
    });
    expect(error).not.toBeNull();
  });

  it("authenticated user CAN insert with own user_id", async () => {
    const { error } = await user.client.from("feedback").insert({
      user_id: user.id,
      message: "Authed feedback từ user thường",
      contact: "user@example.com",
    });
    expect(error).toBeNull();
  });

  it("authenticated user CANNOT insert with user_id null (phải là chính mình)", async () => {
    const { error } = await user.client.from("feedback").insert({
      message: "Authed user gửi ẩn danh",
    });
    expect(error).not.toBeNull();
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
    const { error } = await user.client.from("feedback").insert({
      user_id: user.id,
      message: "   ",
    });
    expect(error).not.toBeNull();
  });

  it("rejects message > 5000 chars", async () => {
    const huge = "x".repeat(5001);
    const { error } = await user.client.from("feedback").insert({
      user_id: user.id,
      message: huge,
    });
    expect(error).not.toBeNull();
  });

  it("rejects contact > 200 chars", async () => {
    const longContact = "x".repeat(201);
    const { error } = await user.client.from("feedback").insert({
      user_id: user.id,
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

  it("regular user CAN select their own feedback (history)", async () => {
    // Plan §32.4 — added `feedback_select_owner` policy so users can
    // see their own submissions ("Đã gửi" history). Other users'
    // rows still hidden.
    const { data, error } = await user.client
      .from("feedback")
      .select("id, user_id");
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.user_id).toBe(user.id);
    }
  });

  it("regular user CANNOT see other users' feedback", async () => {
    // Other user has not inserted anything, but more importantly: the
    // SELECT must not leak `user_id=null` (anon) or other users' rows.
    const { data, error } = await otherUser.client
      .from("feedback")
      .select("id, user_id");
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("platform admin CAN select all feedback", async () => {
    const { data, error } = await admin.client
      .from("feedback")
      .select("id, message, user_id");
    expect(error).toBeNull();
    // Đã chèn 1 dòng hợp lệ ở trên (authed-self); các lần chèn vi phạm ràng buộc / RLS không vào.
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
  });

  // ─── UPDATE / DELETE ───────────────────────────────────────────

  // ─── Sanitize trigger (§32.4) ──────────────────────────────────

  it("page_url is sanitized to page_path with origin stripped + IDs masked", async () => {
    const rawUrl =
      "https://family-tree.example.com/clans/8846cf08-1e93-4fa2-9a82-e17e5677e544/people/12345?token=secret";
    const { error: insertErr } = await user.client.from("feedback").insert({
      user_id: user.id,
      message: "sanitize check",
      page_url: rawUrl,
    });
    expect(insertErr).toBeNull();

    const { data } = await adminClient()
      .from("feedback")
      .select("page_path, page_url")
      .eq("message", "sanitize check")
      .limit(1)
      .single();
    expect(data?.page_url).toBeNull();
    expect(data?.page_path).toBe("/clans/:id/people/:id");
  });

  // ─── Admin update (§32.4) ──────────────────────────────────────

  it("platform admin CAN update status + admin_note", async () => {
    const { data: rows } = await adminClient()
      .from("feedback")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    const rowId = rows?.[0]?.id;
    expect(rowId).toBeTruthy();

    const { error } = await admin.client
      .from("feedback")
      .update({ status: "resolved", admin_note: "đã trả lời" })
      .eq("id", rowId!);
    expect(error).toBeNull();

    const { data: after } = await adminClient()
      .from("feedback")
      .select("status, admin_note")
      .eq("id", rowId!)
      .single();
    expect(after?.status).toBe("resolved");
    expect(after?.admin_note).toBe("đã trả lời");
  });

  // Từ migration 20261111120000: người gửi tự sửa nội dung / xoá góp ý của mình khi status = 'new'; KHÔNG đổi được trạng thái.
  it("người gửi sửa được nội dung góp ý của mình khi còn 'new' nhưng KHÔNG đổi được status; xoá được khi còn 'new'", async () => {
    const { data: rows } = await adminClient().from("feedback").select("id").eq("user_id", user.id).eq("status", "new").limit(1);
    const rowId = rows?.[0]?.id;
    expect(rowId).toBeTruthy();

    const edit = await user.client.from("feedback").update({ message: "đã sửa nội dung" }, { count: "exact" }).eq("id", rowId!);
    expect(edit.error).toBeNull();
    expect(edit.count).toBe(1);

    const status = await user.client.from("feedback").update({ status: "resolved" }, { count: "exact" }).eq("id", rowId!);
    expect(status.error !== null || (status.count ?? 0) === 0).toBe(true);
    const { data: after } = await adminClient().from("feedback").select("status").eq("id", rowId!).single();
    expect(after?.status).toBe("new");

    const del = await user.client.from("feedback").delete({ count: "exact" }).eq("id", rowId!);
    expect(del.error).toBeNull();
    expect(del.count).toBe(1);
  });
});
