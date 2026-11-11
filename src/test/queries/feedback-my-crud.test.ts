import { afterAll, describe, expect, it } from "vitest";

import {
  deleteMyFeedback,
  listMyFeedback,
  updateMyFeedback,
} from "@/lib/queries/feedback";

import { adminClient, createTestUser, deleteUser } from "../supabase-helpers";

describe("queries: feedback — người gửi sửa/xoá góp ý của mình", () => {
  const cleanup: string[] = [];
  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  async function seed(userId: string, client: ReturnType<typeof adminClient>) {
    const r = await client
      .from("feedback")
      .insert({ user_id: userId, message: "Gốc", category: "idea" })
      .select("id")
      .single();
    return r.data!.id as string;
  }

  it("sửa được khi còn 'new'; không sửa được khi đã xem; xoá tương tự", async () => {
    const me = await createTestUser({ displayName: "Tôi" });
    cleanup.push(me.id);
    const id = await seed(me.id, adminClient());

    await updateMyFeedback(id, { message: "Đã sửa", category: "bug", contact: "0900" }, me.client);
    let rows = await listMyFeedback(me.client);
    expect(rows[0]).toMatchObject({ message: "Đã sửa", category: "bug", contact: "0900" });

    // Quản trị đã xem → khoá.
    await adminClient().from("feedback").update({ status: "seen" }).eq("id", id);
    await expect(
      updateMyFeedback(id, { message: "Sửa nữa", category: "bug", contact: null }, me.client),
    ).rejects.toThrow(/không sửa được/);
    await expect(deleteMyFeedback(id, me.client)).rejects.toThrow(/không xoá được/);

    // Còn 'new' thì xoá được.
    const id2 = await seed(me.id, adminClient());
    await deleteMyFeedback(id2, me.client);
    rows = await listMyFeedback(me.client);
    expect(rows.map((r) => r.id)).not.toContain(id2);
  });

  it("không tự đổi trạng thái / phản hồi, không đụng góp ý của người khác", async () => {
    const me = await createTestUser({ displayName: "Tôi 2" });
    const other = await createTestUser({ displayName: "Người khác" });
    cleanup.push(me.id, other.id);
    const mine = await seed(me.id, adminClient());
    const theirs = await seed(other.id, adminClient());

    // Cố tự đặt "đã xử lý" + phản hồi → trigger chặn.
    const hack = await me.client
      .from("feedback")
      .update({ status: "resolved", admin_reply: "tự trả lời" })
      .eq("id", mine)
      .select("id");
    expect(hack.error).not.toBeNull();

    // Sửa góp ý của người khác → không dòng nào bị đổi.
    const peer = await me.client.from("feedback").update({ message: "phá" }).eq("id", theirs).select("id");
    expect(peer.data ?? []).toHaveLength(0);
    const del = await me.client.from("feedback").delete().eq("id", theirs).select("id");
    expect(del.data ?? []).toHaveLength(0);
  });
});
