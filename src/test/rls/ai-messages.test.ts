import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  adminClient,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Lịch sử trò chuyện với trợ lý — CHỖ DỄ SAI NHẤT của cả tính năng AI.
 *
 * Bảng này chứa câu hỏi nguyên văn của từng người. Phản xạ tự nhiên khi
 * viết policy trong repo này là gõ `is_clan_member(clan_id)` — helper đó
 * có mặt ở gần như mọi bảng khác. Ở đây nó cho **trưởng họ đọc câu hỏi
 * riêng của con cháu**, biến trợ lý thành công cụ giám sát gia đình.
 *
 * Nguy hiểm ở chỗ hỏng kiểu đó KHÔNG lộ ra: app vẫn chạy, không ai báo
 * lỗi, chỉ có dữ liệu riêng tư âm thầm mở ra cho người khác. Nên phải có
 * test đứng canh — plan §Bảo mật mục 14.
 */
describe("RLS: ai_messages (lịch sử chat)", () => {
  const admin = adminClient();
  let me: TestUser;
  let clanAdmin: TestUser;
  let platformAdmin: TestUser;
  let clanId: string;
  let myRow: string;

  beforeAll(async () => {
    me = await createTestUser({ displayName: "ChatMe" });
    clanAdmin = await createTestUser({ displayName: "ChatClanAdmin" });
    platformAdmin = await createTestUser({
      displayName: "ChatPlatformAdmin",
      isPlatformAdmin: true,
    });
    // clanAdmin sở hữu dòng họ; `me` là thành viên trong đó.
    clanId = await createTestClan(clanAdmin, { name: "Họ Trò Chuyện" });
    await addMember(clanId, me, "editor");

    const { data, error } = await admin
      .from("ai_messages")
      .insert({
        owner_id: me.id,
        clan_id: clanId,
        role: "user",
        kind: "qa",
        content: "Tôi gọi bác Ba là gì?",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    myRow = data.id;
  });

  afterAll(async () => {
    await deleteUser(me.id);
    await deleteUser(clanAdmin.id);
    await deleteUser(platformAdmin.id);
  });

  it("chính chủ đọc được câu mình đã hỏi", async () => {
    const { data, error } = await me.client
      .from("ai_messages")
      .select("content")
      .eq("id", myRow)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.content).toBe("Tôi gọi bác Ba là gì?");
  });

  it("TRƯỞNG HỌ KHÔNG đọc được câu hỏi của thành viên", async () => {
    // Đây là ca mà `is_clan_member` sẽ cho qua. Nếu test này đỏ, nghĩa là
    // policy đã bị đổi sang helper đó — và trợ lý vừa thành máy nghe lén.
    const { data } = await clanAdmin.client
      .from("ai_messages")
      .select("id, content")
      .eq("clan_id", clanId);
    expect(data ?? []).toHaveLength(0);
  });

  it("PLATFORM ADMIN cũng không đọc được — khác mọi bảng khác trong app", async () => {
    const { data } = await platformAdmin.client
      .from("ai_messages")
      .select("id")
      .eq("clan_id", clanId);
    expect(data ?? []).toHaveLength(0);
  });

  it("khách vãng lai không đọc được gì", async () => {
    const { data } = await anonClient().from("ai_messages").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("client KHÔNG tự bịa được lịch sử — không có policy INSERT", async () => {
    // Nếu chèn được, người dùng có thể dựng một đoạn hội thoại giả rồi
    // chụp màn hình đổ cho trợ lý.
    const { error } = await me.client.from("ai_messages").insert({
      owner_id: me.id,
      clan_id: clanId,
      role: "assistant",
      kind: "qa",
      content: "Câu trả lời bịa",
    });
    expect(error).not.toBeNull();
  });

  it("client không SỬA được nội dung đã lưu", async () => {
    const { error } = await me.client
      .from("ai_messages")
      .update({ content: "sửa lại" })
      .eq("id", myRow);
    const { data } = await admin
      .from("ai_messages")
      .select("content")
      .eq("id", myRow)
      .single();
    expect(error === null || !!error).toBe(true); // hoặc chặn, hoặc không khớp dòng nào
    expect(data?.content).toBe("Tôi gọi bác Ba là gì?");
  });

  it("chính chủ xoá được lịch sử của mình", async () => {
    const { data: tmp } = await admin
      .from("ai_messages")
      .insert({
        owner_id: me.id,
        clan_id: clanId,
        role: "user",
        kind: "qa",
        content: "câu tạm",
      })
      .select("id")
      .single();

    const { error } = await me.client
      .from("ai_messages")
      .delete()
      .eq("id", tmp!.id);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from("ai_messages")
      .select("id")
      .eq("id", tmp!.id);
    expect(after ?? []).toHaveLength(0);
  });

  it("người khác KHÔNG xoá hộ được", async () => {
    await clanAdmin.client.from("ai_messages").delete().eq("id", myRow);
    const { data } = await admin
      .from("ai_messages")
      .select("id")
      .eq("id", myRow);
    expect(data ?? []).toHaveLength(1);
  });

  it("chỉ giữ 40 tin gần nhất cho mỗi người trong mỗi dòng họ", async () => {
    // Trần này là thứ giữ cho bảng không phình thành kho PII. Trigger
    // chạy lúc ghi, nên phải kiểm bằng cách ghi thật.
    const rows = Array.from({ length: 45 }, (_, i) => ({
      owner_id: me.id,
      clan_id: clanId,
      role: "user" as const,
      kind: "qa" as const,
      content: `tin ${i}`,
      created_at: new Date(Date.now() + i * 1000).toISOString(),
    }));
    for (const r of rows) await admin.from("ai_messages").insert(r);

    const { count } = await admin
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", me.id)
      .eq("clan_id", clanId);
    expect(count).toBe(40);

    // Giữ tin MỚI nhất, không phải tin cũ.
    const { data: newest } = await admin
      .from("ai_messages")
      .select("content")
      .eq("owner_id", me.id)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(newest?.[0]?.content).toBe("tin 44");
  });

  it("hàm dọn theo hạn giữ xoá tin cũ, giữ tin mới", async () => {
    const old = new Date(Date.now() - 400 * 86400_000).toISOString();
    await admin.from("ai_messages").insert({
      owner_id: me.id,
      clan_id: clanId,
      role: "user",
      kind: "qa",
      content: "tin rất cũ",
      created_at: old,
    });

    const { error } = await admin.rpc("ai_messages_purge_expired");
    expect(error).toBeNull();

    const { data } = await admin
      .from("ai_messages")
      .select("id")
      .eq("owner_id", me.id)
      .eq("content", "tin rất cũ");
    expect(data ?? []).toHaveLength(0);
  });

  it("người dùng thường KHÔNG gọi được hàm dọn", async () => {
    const { error } = await me.client.rpc("ai_messages_purge_expired");
    expect(error).not.toBeNull();
  });
});
