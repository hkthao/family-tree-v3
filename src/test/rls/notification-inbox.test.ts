import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Hộp thư trong chuông — nội dung riêng của từng người.
 *
 * Đây là bảng ghi "đã gửi gì cho ai", giờ mang thêm tiêu đề và nội dung
 * đọc được. Nghĩa là rò rỉ ở đây là đọc được thông báo riêng của nhà
 * người khác: giỗ nhà ai, đóng góp nào đang chờ duyệt.
 */
describe("RLS: hộp thư thông báo", () => {
  const admin = adminClient();
  let me: TestUser;
  let other: TestUser;
  let clanId: string;
  let myRow: string;

  beforeAll(async () => {
    me = await createTestUser({ displayName: "InboxMe" });
    other = await createTestUser({ displayName: "InboxOther" });
    clanId = await createTestClan(me, { name: "Họ Chuông" });

    const { data, error } = await admin
      .from("notification_log")
      .insert({
        user_id: me.id,
        clan_id: clanId,
        event_key: "test:inbox:1",
        channel: "inapp",
        status: "sent",
        title: "Còn 7 ngày: Giỗ cụ tổ",
        body: "Ngày 2026-09-05.",
        url: `/clans/${clanId}/events`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    myRow = data.id;
  });

  afterAll(async () => {
    await deleteUser(me.id);
    await deleteUser(other.id);
  });

  it("kênh 'inapp' và 'webpush' ghi được — ràng buộc cũ chỉ cho email/sms", async () => {
    // Chính ràng buộc đó đã làm mọi lượt ghi dedupe của web push bị từ
    // chối im lặng suốt thời gian qua.
    const { error } = await admin.from("notification_log").insert({
      user_id: me.id,
      clan_id: clanId,
      event_key: "test:push:1",
      channel: "webpush",
      status: "sent",
    });
    expect(error).toBeNull();
  });

  it("chính chủ đọc được thông báo của mình", async () => {
    const { data, error } = await me.client
      .from("notification_log")
      .select("title, url")
      .eq("id", myRow)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.title).toMatch(/Giỗ cụ tổ/);
  });

  it("người khác KHÔNG đọc được — kể cả biết id", async () => {
    const { data } = await other.client
      .from("notification_log")
      .select("title")
      .eq("id", myRow);
    expect(data ?? []).toHaveLength(0);
  });

  it("chính chủ đánh dấu đã đọc được", async () => {
    const { error } = await me.client
      .from("notification_log")
      .update({ read_at: new Date().toISOString() })
      .eq("id", myRow);
    expect(error).toBeNull();

    const { data } = await admin
      .from("notification_log")
      .select("read_at")
      .eq("id", myRow)
      .single();
    expect(data?.read_at).not.toBeNull();
  });

  it("người khác KHÔNG đánh dấu hộ được", async () => {
    const { data: before } = await admin
      .from("notification_log")
      .select("read_at")
      .eq("id", myRow)
      .single();
    await other.client
      .from("notification_log")
      .update({ read_at: null })
      .eq("id", myRow);
    const { data: after } = await admin
      .from("notification_log")
      .select("read_at")
      .eq("id", myRow)
      .single();
    expect(after?.read_at).toBe(before?.read_at);
  });

  it("notifications_mark_all_read chỉ đụng tới thông báo của chính mình", async () => {
    await admin.from("notification_log").insert({
      user_id: other.id,
      clan_id: clanId,
      event_key: "test:inbox:other",
      channel: "inapp",
      status: "sent",
      title: "Của người khác",
    });
    // me đọc hết phần của mình
    const { error } = await me.client.rpc("notifications_mark_all_read");
    expect(error).toBeNull();

    const { data } = await admin
      .from("notification_log")
      .select("read_at")
      .eq("user_id", other.id)
      .eq("event_key", "test:inbox:other")
      .single();
    expect(data?.read_at).toBeNull();
  });

  it("khách chưa đăng nhập không gọi được hàm đánh dấu", async () => {
    const { error } = await adminClient().rpc("notifications_mark_all_read");
    // service role không có auth.uid() → hàm phải từ chối, không im lặng
    // đánh dấu nhầm của ai đó.
    expect(error).not.toBeNull();
  });
});
