import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Danh sách "chưa gắn vào cây" trong kiểu xem thư mục.
 *
 * Bản đầu định nghĩa sai — coi ai không có cha mẹ là chưa gắn — nên dâu/
 * rể bị liệt vào đó, dù họ đang đứng ngay cạnh vợ/chồng mình trong cây.
 * Đo trên production: 2.329 người không cha mẹ thì 2.221 là vợ/chồng,
 * tức 95% danh sách cũ là báo động giả.
 */
describe("RLS + logic: clan_unlinked_*", () => {
  const admin = adminClient();
  let owner: TestUser;
  let stranger: TestUser;
  let clanId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "UnlinkedOwner" });
    stranger = await createTestUser({ displayName: "UnlinkedStranger" });
    clanId = await createTestClan(owner, { name: "Họ Rời" });

    const add = async (name: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await admin
        .from("persons")
        .insert({
          clan_id: clanId,
          full_name: name,
          gender: "M",
          ...extra,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    };

    const to = await add("Thuỷ Tổ", { is_root: true });
    const wife = await add("Lê Thị Dậu", { gender: "F" });
    await add("Người Rời Thật");

    // Vợ của thuỷ tổ: KHÔNG có cha mẹ, nhưng có mặt trong cây.
    const { error } = await admin
      .from("families")
      .insert({ clan_id: clanId, husband_id: to, wife_id: wife });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(stranger.id);
  });

  it("KHÔNG tính vợ/chồng là 'chưa gắn' — họ đang ở trong cây", async () => {
    const { data, error } = await owner.client.rpc("clan_unlinked_count", {
      p_clan: clanId,
    });
    expect(error).toBeNull();
    // Chỉ còn đúng "Người Rời Thật"; thuỷ tổ và bà vợ đều không tính.
    expect(data).toBe(1);
  });

  it("danh sách khớp với con số — cùng một hàm nên không lệch được", async () => {
    const { data } = await owner.client.rpc("clan_unlinked_persons", {
      p_clan: clanId,
    });
    const names = (data as unknown as { full_name: string }[]).map(
      (p) => p.full_name,
    );
    expect(names).toEqual(["Người Rời Thật"]);
  });

  it("tìm được bằng chữ KHÔNG DẤU", async () => {
    const { data } = await owner.client.rpc("clan_unlinked_persons", {
      p_clan: clanId,
      p_search: "nguoi roi",
    });
    expect((data as unknown[]).length).toBe(1);
  });

  it("người ngoài KHÔNG đọc được danh sách của dòng họ riêng tư", async () => {
    const { data } = await stranger.client.rpc("clan_unlinked_persons", {
      p_clan: clanId,
    });
    expect((data as unknown[]) ?? []).toHaveLength(0);

    const { data: count } = await stranger.client.rpc("clan_unlinked_count", {
      p_clan: clanId,
    });
    expect(count).toBe(0);
  });

  it("khách vãng lai cũng không đọc được", async () => {
    const { data, error } = await anonClient().rpc("clan_unlinked_count", {
      p_clan: clanId,
    });
    // Hoặc bị chặn hẳn, hoặc trả 0 — miễn là KHÔNG lộ người nào.
    expect(error !== null || data === 0 || data === null).toBe(true);
    const { data: rows } = await anonClient().rpc("clan_unlinked_persons", {
      p_clan: clanId,
    });
    expect((rows as unknown[]) ?? []).toHaveLength(0);
  });

  it("trần số dòng trả về — không ai kéo cả dòng họ bằng p_limit khổng lồ", async () => {
    const { data, error } = await owner.client.rpc("clan_unlinked_persons", {
      p_clan: clanId,
      p_limit: 100000,
    });
    expect(error).toBeNull();
    expect((data as unknown[]).length).toBeLessThanOrEqual(200);
  });
});
