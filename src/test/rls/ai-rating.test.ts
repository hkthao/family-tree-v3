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
 * Chấm điểm câu trả lời của trợ lý.
 *
 * Hàm là `security definer` nên phải tự chặn hai thứ: chấm hộ lượt của
 * người khác, và điểm không hợp lệ. Nếu lọt cái đầu thì bất kỳ ai cũng
 * bơm được điểm xấu vào lượt của người khác, và con số "hài lòng" trên
 * màn báo cáo thành vô nghĩa.
 */
describe("RLS: chấm điểm câu trả lời", () => {
  const admin = adminClient();
  let me: TestUser;
  let other: TestUser;
  let clanId: string;
  const myRef = `qa:${crypto.randomUUID()}`;

  const ratingOf = async (ref: string) => {
    const { data } = await admin
      .from("ai_usage")
      .select("rating, rated_at")
      .eq("turn_ref", ref)
      .single();
    return data;
  };

  beforeAll(async () => {
    me = await createTestUser({ displayName: "RateMe" });
    other = await createTestUser({ displayName: "RateOther" });
    clanId = await createTestClan(me, { name: "Họ Chấm Điểm" });

    const { error } = await admin.from("ai_usage").insert({
      clan_id: clanId,
      user_id: me.id,
      kind: "qa",
      model_id: "gpt-5.6-luna",
      turn_ref: myRef,
      ok: true,
    });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await admin.from("ai_usage").delete().eq("turn_ref", myRef);
    await deleteUser(me.id);
    await deleteUser(other.id);
  });

  it("chính chủ chấm được lượt của mình", async () => {
    const { error } = await me.client.rpc("ai_rate_turn", {
      p_ref: myRef,
      p_rating: 1,
    });
    expect(error).toBeNull();
    expect((await ratingOf(myRef))?.rating).toBe(1);
  });

  it("đổi ý được: chấm lại thành không hài lòng", async () => {
    await me.client.rpc("ai_rate_turn", { p_ref: myRef, p_rating: -1 });
    expect((await ratingOf(myRef))?.rating).toBe(-1);
  });

  it("gỡ điểm bằng 0 — và xoá luôn mốc thời gian đã chấm", async () => {
    await me.client.rpc("ai_rate_turn", { p_ref: myRef, p_rating: 0 });
    const row = await ratingOf(myRef);
    expect(row?.rating).toBeNull();
    expect(row?.rated_at).toBeNull();
  });

  it("NGƯỜI KHÁC không chấm được lượt của tôi", async () => {
    await me.client.rpc("ai_rate_turn", { p_ref: myRef, p_rating: 1 });
    const { error } = await other.client.rpc("ai_rate_turn", {
      p_ref: myRef,
      p_rating: -1,
    });
    // Hàm im lặng bỏ qua (không báo lỗi để khỏi thành cách dò mã lượt),
    // nhưng điểm phải không đổi.
    expect(error).toBeNull();
    expect((await ratingOf(myRef))?.rating).toBe(1);
  });

  it("điểm ngoài -1/0/1 bị từ chối", async () => {
    const { error } = await me.client.rpc("ai_rate_turn", {
      p_ref: myRef,
      p_rating: 5,
    });
    expect(error).not.toBeNull();
    expect((await ratingOf(myRef))?.rating).toBe(1);
  });

  it("mã lượt lạ thì im lặng, không báo lỗi để dò", async () => {
    const { error } = await me.client.rpc("ai_rate_turn", {
      p_ref: "qa:khong-co-that",
      p_rating: 1,
    });
    expect(error).toBeNull();
  });

  it("khách chưa đăng nhập không chấm được", async () => {
    const { error } = await anonClient().rpc("ai_rate_turn", {
      p_ref: myRef,
      p_rating: -1,
    });
    expect(error).not.toBeNull();
  });

  it("người dùng thường vẫn KHÔNG đọc được bảng ai_usage", async () => {
    // Chấm điểm được không có nghĩa là xem được số liệu vận hành.
    const { data } = await me.client.from("ai_usage").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("báo cáo tính tỉ lệ hài lòng trên SỐ LƯỢT ĐƯỢC CHẤM", async () => {
    const boss = await createTestUser({
      displayName: "RateAdmin",
      isPlatformAdmin: true,
    });
    try {
      const { data } = await boss.client.rpc("ai_usage_overview", {
        p_days: 30,
      });
      const o = data as unknown as { rated: number; liked_ratio: number | null };
      expect(o.rated).toBeGreaterThanOrEqual(1);
      expect(o.liked_ratio).not.toBeNull();
      expect(o.liked_ratio!).toBeGreaterThan(0);
      expect(o.liked_ratio!).toBeLessThanOrEqual(1);
    } finally {
      await deleteUser(boss.id);
    }
  });
});
