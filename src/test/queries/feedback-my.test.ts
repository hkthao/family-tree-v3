import { afterAll, describe, expect, it } from "vitest";

import { listMyFeedback, updateFeedback } from "@/lib/queries/feedback";

import { adminClient, createTestUser, deleteUser } from "../supabase-helpers";

describe("queries: feedback — người gửi xem lại góp ý và phản hồi", () => {
  const cleanup: string[] = [];
  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("thấy trạng thái + phản hồi của admin, KHÔNG thấy ghi chú nội bộ; không thấy góp ý của người khác", async () => {
    const me = await createTestUser({ displayName: "Gửi góp ý" });
    const other = await createTestUser({ displayName: "Người khác" });
    cleanup.push(me.id, other.id);

    const mine = await me.client
      .from("feedback")
      .insert({ user_id: me.id, message: "Nút lưu bị lỗi", category: "bug" })
      .select("id")
      .single();
    expect(mine.error).toBeNull();
    await other.client
      .from("feedback")
      .insert({ user_id: other.id, message: "Góp ý của người khác", category: "idea" });

    // Admin (service role) xử lý: đổi trạng thái, ghi chú nội bộ + phản hồi.
    const admin = adminClient();
    const { error } = await admin
      .from("feedback")
      .update({
        status: "resolved",
        admin_note: "NỘI BỘ: khách hay báo, ưu tiên thấp",
        admin_reply: "Cảm ơn bạn, lỗi đã được sửa.",
        replied_at: new Date().toISOString(),
      })
      .eq("id", mine.data!.id);
    expect(error).toBeNull();

    const rows = await listMyFeedback(me.client);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      message: "Nút lưu bị lỗi",
      status: "resolved",
      admin_reply: "Cảm ơn bạn, lỗi đã được sửa.",
    });
    expect(Object.keys(rows[0])).not.toContain("admin_note");
  });

  it("updateFeedback đóng dấu replied_at khi có phản hồi và xoá khi bỏ phản hồi", async () => {
    // Dùng bản chạy qua service role để kiểm payload (admin thật là platform admin).
    const me = await createTestUser({ displayName: "Gửi 2" });
    cleanup.push(me.id);
    const admin = adminClient();
    const row = await admin
      .from("feedback")
      .insert({ user_id: me.id, message: "Hỏi chút", category: "question" })
      .select("id")
      .single();
    await updateFeedback(row.data!.id, { admin_reply: "Đã trả lời" }, admin);
    let got = await admin.from("feedback").select("admin_reply, replied_at").eq("id", row.data!.id).single();
    expect(got.data!.admin_reply).toBe("Đã trả lời");
    expect(got.data!.replied_at).not.toBeNull();
    await updateFeedback(row.data!.id, { admin_reply: null }, admin);
    got = await admin.from("feedback").select("admin_reply, replied_at").eq("id", row.data!.id).single();
    expect(got.data!.replied_at).toBeNull();
  });
});
