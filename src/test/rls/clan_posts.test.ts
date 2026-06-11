import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  adminClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * RLS + trigger tests cho §32.3 clan_posts.
 *
 * Plan §32.8 T2.1–T2.8:
 *  - T2.1 cross-clan: member clan A không đọc bài clan B
 *  - T2.2 non-admin INSERT bị ép 'pending'; thử insert 'published' → reject
 *  - T2.3 KEY: author thử UPDATE đổi status='published' → trigger guard giữ
 *  - T2.4 admin gọi RPC → status + audit row
 *  - T2.5 comment client gửi clan_id sai → trigger ép lại
 *  - T2.6 user suspended → INSERT reject
 *  - T2.7 bài hidden: hiện cho author, ẩn cho người khác
 *  - T2.8 DELETE bị từ chối ở mọi role (RLS không expose)
 */
describe("RLS: clan_posts", () => {
  let admin: TestUser;
  let memberA: TestUser; // member của clan A
  let memberA2: TestUser; // member khác của clan A (test cross-author isolation)
  let memberB: TestUser; // member của clan B (test cross-clan)
  let suspended: TestUser;
  let clanA: string;
  let clanB: string;

  beforeAll(async () => {
    admin = await createTestUser({
      displayName: "PostAdmin",
      isPlatformAdmin: false, // platform admin sẽ override mọi thứ — test riêng clan-admin
      maxClans: 5,
    });
    memberA = await createTestUser({ displayName: "PostMemberA" });
    memberA2 = await createTestUser({ displayName: "PostMemberA2" });
    memberB = await createTestUser({ displayName: "PostMemberB" });
    suspended = await createTestUser({
      displayName: "PostSuspended",
      isSuspended: true,
    });

    clanA = await createTestClan(admin, { name: "Họ Post A", maxUsers: 10 });
    clanB = await createTestClan(admin, { name: "Họ Post B", maxUsers: 10 });

    // Memberships: memberA + memberA2 + suspended ở clanA; memberB ở clanB.
    await addMember(clanA, memberA, "editor");
    await addMember(clanA, memberA2, "editor");
    await addMember(clanA, suspended, "editor");
    await addMember(clanB, memberB, "editor");

    // Slate clean
    await adminClient()
      .from("clan_posts")
      .delete()
      .gte("created_at", "1970-01-01");
  });

  afterAll(async () => {
    await adminClient()
      .from("clan_posts")
      .delete()
      .gte("created_at", "1970-01-01");
    await deleteUser(admin.id);
    await deleteUser(memberA.id);
    await deleteUser(memberA2.id);
    await deleteUser(memberB.id);
    await deleteUser(suspended.id);
  });

  // ─── T2.2 + T2.6: INSERT semantics ──────────────────────────────

  it("non-admin INSERT 'published' is rejected; 'pending' allowed", async () => {
    // Thử 'published' từ member thường → policy reject.
    const tryPublished = await memberA.client.from("clan_posts").insert({
      clan_id: clanA,
      author_id: memberA.id,
      body: "thử đăng thẳng",
      status: "published",
    });
    expect(tryPublished.error).not.toBeNull();

    // 'pending' OK.
    const tryPending = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "đề xuất duyệt",
        status: "pending",
      })
      .select("id, status")
      .single();
    expect(tryPending.error).toBeNull();
    expect(tryPending.data?.status).toBe("pending");
  });

  it("clan admin INSERT 'published' is allowed", async () => {
    const { data, error } = await admin.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: admin.id,
        body: "thông báo họp họ tháng 6",
        status: "published",
      })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("published");
  });

  it("suspended user CANNOT INSERT post (T2.6)", async () => {
    const { error } = await suspended.client.from("clan_posts").insert({
      clan_id: clanA,
      author_id: suspended.id,
      body: "tôi bị treo",
      status: "pending",
    });
    expect(error).not.toBeNull();
  });

  it("non-member CANNOT INSERT into a clan they don't belong to", async () => {
    const { error } = await memberB.client.from("clan_posts").insert({
      clan_id: clanA,
      author_id: memberB.id,
      body: "tôi không trong họ này",
      status: "pending",
    });
    expect(error).not.toBeNull();
  });

  // ─── T2.1 cross-clan ────────────────────────────────────────────

  it("cross-clan isolation: memberA cannot read clanB posts (T2.1)", async () => {
    // Admin đăng 1 bài vào clanB.
    await admin.client.from("clan_posts").insert({
      clan_id: clanB,
      author_id: admin.id,
      body: "bài clan B",
      status: "published",
    });

    const { data, error } = await memberA.client
      .from("clan_posts")
      .select("id, clan_id");
    expect(error).toBeNull();
    for (const r of data ?? []) {
      expect(r.clan_id).toBe(clanA);
    }
  });

  // ─── T2.3 KEY guard ─────────────────────────────────────────────

  it("non-admin author UPDATE status='published' → trigger guard keeps 'pending' (T2.3)", async () => {
    const { data: created } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "tự duyệt thử",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = created!.id;

    // Author tự update status. RLS UPDATE policy cho author → trigger
    // guard hạ status xuống old value.
    const { error } = await memberA.client
      .from("clan_posts")
      .update({ status: "published" })
      .eq("id", postId);
    expect(error).toBeNull();

    const { data: after } = await adminClient()
      .from("clan_posts")
      .select("status")
      .eq("id", postId)
      .single();
    // Trigger guard giữ status = 'pending'.
    expect(after?.status).toBe("pending");
  });

  it("non-admin author UPDATE pinned → trigger guard keeps false", async () => {
    const { data: created } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "tự ghim thử",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = created!.id;

    await memberA.client
      .from("clan_posts")
      .update({ pinned: true })
      .eq("id", postId);

    const { data: after } = await adminClient()
      .from("clan_posts")
      .select("pinned")
      .eq("id", postId)
      .single();
    expect(after?.pinned).toBe(false);
  });

  it("non-admin author CAN update title/body of their own pending post", async () => {
    const { data: created } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "bản gốc",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = created!.id;

    const { error } = await memberA.client
      .from("clan_posts")
      .update({ body: "bản sửa" })
      .eq("id", postId);
    expect(error).toBeNull();

    const { data: after } = await adminClient()
      .from("clan_posts")
      .select("body")
      .eq("id", postId)
      .single();
    expect(after?.body).toBe("bản sửa");
  });

  // ─── T2.4 admin RPC ─────────────────────────────────────────────

  it("admin clan_post_moderate('publish') flips status + writes audit (T2.4)", async () => {
    const { data: created } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "duyệt qua RPC",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = created!.id;

    const { error } = await admin.client.rpc("clan_post_moderate", {
      p_post_id: postId,
      p_action: "publish",
      p_note: "OK",
    });
    expect(error).toBeNull();

    const { data: after } = await adminClient()
      .from("clan_posts")
      .select("status")
      .eq("id", postId)
      .single();
    expect(after?.status).toBe("published");

    const { data: audit } = await admin.client
      .from("clan_post_audit")
      .select("action, old_status, new_status, note")
      .eq("post_id", postId);
    expect(audit?.length).toBe(1);
    expect(audit?.[0].action).toBe("publish");
    expect(audit?.[0].old_status).toBe("pending");
    expect(audit?.[0].new_status).toBe("published");
    expect(audit?.[0].note).toBe("OK");
  });

  it("non-admin cannot call clan_post_moderate", async () => {
    const { data: created } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "thử duyệt từ member thường",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = created!.id;

    const { error } = await memberA.client.rpc("clan_post_moderate", {
      p_post_id: postId,
      p_action: "publish",
    });
    expect(error).not.toBeNull();
  });

  // ─── T2.5 comment clan_id forced ────────────────────────────────

  it("comment trigger forces clan_id to match post's clan (T2.5)", async () => {
    // Tạo 1 bài đã publish ở clan A.
    const { data: post } = await admin.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: admin.id,
        body: "bài để comment",
        status: "published",
      })
      .select("id")
      .single();

    // memberA gửi comment kèm clan_id SAI (clanB).
    const { data: comment, error } = await memberA.client
      .from("clan_post_comments")
      .insert({
        post_id: post!.id,
        // Cố tình sai:
        clan_id: clanB,
        author_id: memberA.id,
        body: "thử bypass",
      })
      .select("clan_id")
      .single();
    expect(error).toBeNull();
    // Trigger ép về clan của post (clanA).
    expect(comment?.clan_id).toBe(clanA);
  });

  // ─── T2.7 hidden visibility ─────────────────────────────────────

  it("hidden post: visible to author, hidden to other members (T2.7)", async () => {
    const { data: post } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "tin chuẩn bị ẩn",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = post!.id;

    // Admin ẩn qua RPC (giả lập "reject" hoặc "hide").
    await admin.client.rpc("clan_post_moderate", {
      p_post_id: postId,
      p_action: "hide",
    });

    // Author thấy được (vì author_id = auth.uid()).
    const authorView = await memberA.client
      .from("clan_posts")
      .select("id")
      .eq("id", postId);
    expect(authorView.data?.length).toBe(1);

    // Member khác trong cùng clan KHÔNG thấy bài hidden.
    const otherView = await memberA2.client
      .from("clan_posts")
      .select("id")
      .eq("id", postId);
    expect(otherView.data?.length).toBe(0);

    // Admin thấy được.
    const adminView = await admin.client
      .from("clan_posts")
      .select("id")
      .eq("id", postId);
    expect(adminView.data?.length).toBe(1);
  });

  // ─── T2.8 DELETE blocked ────────────────────────────────────────

  it("DELETE is not exposed — author cannot delete own post", async () => {
    const { data: post } = await memberA.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: memberA.id,
        body: "thử xoá",
        status: "pending",
      })
      .select("id")
      .single();
    const postId = post!.id;

    const { error, count } = await memberA.client
      .from("clan_posts")
      .delete({ count: "exact" })
      .eq("id", postId);
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(count ?? 0).toBe(0);
    }

    // Row vẫn còn ở DB.
    const { data: still } = await adminClient()
      .from("clan_posts")
      .select("id")
      .eq("id", postId);
    expect(still?.length).toBe(1);
  });

  it("admin clan DELETE also blocked — soft-delete via RPC only", async () => {
    const { data: post } = await admin.client
      .from("clan_posts")
      .insert({
        clan_id: clanA,
        author_id: admin.id,
        body: "admin thử xoá cứng",
        status: "published",
      })
      .select("id")
      .single();
    const postId = post!.id;

    const { count } = await admin.client
      .from("clan_posts")
      .delete({ count: "exact" })
      .eq("id", postId);
    expect(count ?? 0).toBe(0);

    const { data: still } = await adminClient()
      .from("clan_posts")
      .select("id")
      .eq("id", postId);
    expect(still?.length).toBe(1);
  });
});
