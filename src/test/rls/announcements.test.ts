import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * RLS tests cho §32.2 announcements.
 *
 * Bám đúng các T1.* trong plan §32.8:
 *  - T1.1: user thường đọc tin đã publish, không thấy nháp
 *  - T1.2: tin expired không hiện
 *  - T1.3: anon thấy is_public=true, không thấy is_public=false
 *  - T1.4: chỉ platform admin INSERT/UPDATE/DELETE
 *  - T1.5: unread_count đúng sau khi mark
 *  - T1.6: mark_all_read idempotent
 */
describe("RLS: announcements", () => {
  let admin: TestUser;
  let user: TestUser;

  // IDs các tin tạo trong test — track để clean ở after.
  let draftId: string;
  let publishedId: string;
  let publicId: string;
  let expiredId: string;

  beforeAll(async () => {
    admin = await createTestUser({
      displayName: "AnnAdmin",
      isPlatformAdmin: true,
    });
    user = await createTestUser({ displayName: "AnnUser" });

    // Slate clean — test sạch.
    // Clean slate — UUID khác empty so cần filter hợp lệ; dùng "id IS
    // NOT NULL" qua gte(created_at) trick để match mọi row.
    await adminClient()
      .from("announcements")
      .delete()
      .gte("created_at", "1970-01-01");

    const now = new Date();
    const past = new Date(now.getTime() - 60_000).toISOString();
    const future = new Date(now.getTime() + 60 * 60_000).toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    const dayBefore = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();

    // Explicit level/is_public ở mọi row — supabase-js đôi khi gửi
    // null cho cột undefined dù DB có default.
    const { data: rows, error } = await adminClient()
      .from("announcements")
      .insert([
        {
          title: "Draft (chưa đăng)",
          body: "Chỉ admin thấy.",
          level: "info",
          is_public: false,
          created_by: admin.id,
        },
        {
          title: "Published private",
          body: "User auth thấy, anon không thấy.",
          level: "update",
          is_public: false,
          published_at: past,
          created_by: admin.id,
        },
        {
          title: "Published public",
          body: "Cả anon thấy — vào changelog.",
          level: "info",
          is_public: true,
          published_at: past,
          created_by: admin.id,
        },
        {
          title: "Expired",
          body: "Đã hết hạn.",
          level: "warning",
          is_public: true,
          published_at: dayBefore,
          expires_at: yesterday,
          created_by: admin.id,
        },
        {
          title: "Future publish",
          body: "Lên lịch tương lai.",
          level: "info",
          is_public: false,
          published_at: future,
          created_by: admin.id,
        },
      ])
      .select("id, title");
    expect(error).toBeNull();
    expect((rows ?? []).length).toBe(5);
    draftId = rows!.find((r) => r.title === "Draft (chưa đăng)")!.id;
    publishedId = rows!.find((r) => r.title === "Published private")!.id;
    publicId = rows!.find((r) => r.title === "Published public")!.id;
    expiredId = rows!.find((r) => r.title === "Expired")!.id;
  });

  afterAll(async () => {
    // Clean slate — UUID khác empty so cần filter hợp lệ; dùng "id IS
    // NOT NULL" qua gte(created_at) trick để match mọi row.
    await adminClient()
      .from("announcements")
      .delete()
      .gte("created_at", "1970-01-01");
    await deleteUser(admin.id);
    await deleteUser(user.id);
  });

  // ─── T1.1 + T1.2 ─────────────────────────────────────────────────

  it("authenticated user reads published & non-expired (skips draft, expired, future)", async () => {
    const { data, error } = await user.client
      .from("announcements")
      .select("id, title");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(publishedId);
    expect(ids).toContain(publicId);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(expiredId);
    // Future-publish: published_at > now() → cũng phải ẩn.
    expect(ids.length).toBe(2);
  });

  // ─── T1.3 ────────────────────────────────────────────────────────

  it("anon reads is_public=true only", async () => {
    const { data, error } = await anonClient()
      .from("announcements")
      .select("id, title");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toEqual([publicId]);
  });

  // ─── T1.4 ────────────────────────────────────────────────────────

  it("regular user CANNOT insert announcements", async () => {
    const { error } = await user.client.from("announcements").insert({
      title: "Hack",
      body: "Không được phép",
      created_by: user.id,
    });
    expect(error).not.toBeNull();
  });

  it("regular user CANNOT update announcements", async () => {
    const { error, count } = await user.client
      .from("announcements")
      .update({ title: "tampered" }, { count: "exact" })
      .eq("id", publishedId);
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(count ?? 0).toBe(0);
    }
  });

  it("regular user CANNOT delete announcements", async () => {
    const { error, count } = await user.client
      .from("announcements")
      .delete({ count: "exact" })
      .eq("id", publishedId);
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(count ?? 0).toBe(0);
    }
  });

  it("platform admin sees drafts + expired + future too", async () => {
    const { data, error } = await admin.client
      .from("announcements")
      .select("id");
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(5);
  });

  // ─── T1.5 + T1.6 ─────────────────────────────────────────────────

  it("announcements_unread_count() returns correct count, then mark_all_read clears it", async () => {
    // Trước khi mark: user thấy 2 published rows → unread = 2.
    const { data: countBefore, error: e1 } = await user.client.rpc(
      "announcements_unread_count",
    );
    expect(e1).toBeNull();
    expect(countBefore).toBe(2);

    // Mark all read — trả về số row mới chèn.
    const { data: marked, error: e2 } = await user.client.rpc(
      "announcements_mark_all_read",
    );
    expect(e2).toBeNull();
    expect(marked).toBe(2);

    // Sau khi mark: unread = 0.
    const { data: countAfter, error: e3 } = await user.client.rpc(
      "announcements_unread_count",
    );
    expect(e3).toBeNull();
    expect(countAfter).toBe(0);

    // Idempotent — rerun trả 0 (conflict do nothing).
    const { data: rerun, error: e4 } = await user.client.rpc(
      "announcements_mark_all_read",
    );
    expect(e4).toBeNull();
    expect(rerun).toBe(0);
  });

  it("announcement_reads owner-only: user A's reads invisible to user B", async () => {
    const other = await createTestUser({ displayName: "AnnOther" });
    try {
      // user.client should have at least 1 read row from previous test.
      const { data: mine } = await user.client
        .from("announcement_reads")
        .select("user_id");
      const mineRows = mine ?? [];
      expect(mineRows.length).toBeGreaterThan(0);
      for (const r of mineRows) {
        expect(r.user_id).toBe(user.id);
      }

      const { data: theirs } = await other.client
        .from("announcement_reads")
        .select("user_id");
      expect(theirs ?? []).toEqual([]);
    } finally {
      await deleteUser(other.id);
    }
  });
});
