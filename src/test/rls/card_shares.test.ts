import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addMember, adminClient, anonClient, createTestClan, createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

/**
 * Thiệp khoe không còn đọc được thẳng bằng khoá anon (trang /khoe đọc qua function), kho ảnh chỉ thành viên dòng họ ghi / liệt kê
 * (docs/plan-thiep-khoe-design.md + rà soát bảo mật trang công khai). Hàng của test dùng token riêng, dọn sau.
 */
describe("RLS: card_shares + kho ảnh card-shares", () => {
  let owner: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let clanId: string;
  const token = `rlstest${Date.now()}aaaaaaaaaaaaaaaaaa`.slice(0, 32);
  const rowOf = (tok: string, createdBy: string) => ({ token: tok, clan_id: clanId, created_by: createdBy, image_path: `${clanId}/${tok}.png`, title: "Thiệp thử", expires_at: new Date(Date.now() + 86_400_000).toISOString() });

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "CardOwner" });
    member = await createTestUser({ displayName: "CardMember" });
    stranger = await createTestUser({ displayName: "CardStranger" });
    clanId = await createTestClan(owner, { name: "Họ Thiệp" });
    await addMember(clanId, member, "viewer");
    const { error } = await adminClient().from("card_shares").insert(rowOf(token, member.id));
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await adminClient().from("card_shares").delete().like("token", "rlstest%");
    await adminClient().storage.from("card-shares").remove([`${clanId}/${token}.png`, `${clanId}/m-${token}.png`]);
    for (const u of [owner, member, stranger]) await deleteUser(u.id);
  });

  it("khách (khoá anon) KHÔNG đọc được card_shares — không liệt kê được thiệp / token", async () => {
    const { data, error } = await anonClient().from("card_shares").select("token, title").eq("token", token);
    expect(error === null ? (data ?? []).length : 0).toBe(0);
  });

  it("người lạ đã đăng nhập (không thuộc dòng họ) KHÔNG đọc được thiệp của họ khác", async () => {
    const { data } = await stranger.client.from("card_shares").select("token").eq("token", token);
    expect(data ?? []).toHaveLength(0);
  });

  it("người tạo đọc được thiệp của mình; admin dòng họ đọc được thiệp của thành viên", async () => {
    expect(((await member.client.from("card_shares").select("token").eq("token", token)).data ?? []).length).toBe(1);
    expect(((await owner.client.from("card_shares").select("token").eq("token", token)).data ?? []).length).toBe(1);
  });

  it("thành viên tạo thiệp của chính mình được; người lạ KHÔNG tạo được thiệp vào họ khác", async () => {
    const ok = await member.client.from("card_shares").insert(rowOf(`rlstest-m-${Date.now()}`.padEnd(32, "b"), member.id));
    expect(ok.error).toBeNull();
    const bad = await stranger.client.from("card_shares").insert(rowOf(`rlstest-s-${Date.now()}`.padEnd(32, "c"), stranger.id));
    expect(bad.error).not.toBeNull();
  });

  it("kho ảnh: thành viên tải được vào thư mục dòng họ mình; người lạ KHÔNG tải / ghi đè được", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const up = await member.client.storage.from("card-shares").upload(`${clanId}/m-${token}.png`, blob, { contentType: "image/png", upsert: true });
    expect(up.error).toBeNull();
    const evil = await stranger.client.storage.from("card-shares").upload(`${clanId}/s-${token}.png`, blob, { contentType: "image/png", upsert: true });
    expect(evil.error).not.toBeNull();
    const overwrite = await stranger.client.storage.from("card-shares").upload(`${clanId}/m-${token}.png`, new Blob(["x"]), { contentType: "image/png", upsert: true });
    expect(overwrite.error).not.toBeNull();
  });

  it("kho ảnh: người lạ KHÔNG liệt kê được ảnh của họ khác; thư mục không phải UUID bị từ chối", async () => {
    const list = await stranger.client.storage.from("card-shares").list(clanId);
    expect(list.data ?? []).toHaveLength(0);
    const odd = await member.client.storage.from("card-shares").upload(`khong-phai-uuid/x.png`, new Blob(["x"]), { contentType: "image/png" });
    expect(odd.error).not.toBeNull();
  });

  it("ảnh vẫn xem được qua URL công khai của bucket (không cần quyền) cho trang /khoe", async () => {
    const url = adminClient().storage.from("card-shares").getPublicUrl(`${clanId}/m-${token}.png`).data.publicUrl;
    const res = await fetch(url);
    expect(res.status).toBe(200);
  });
});
