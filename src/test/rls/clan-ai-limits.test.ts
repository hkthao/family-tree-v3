import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Hạn mức trợ lý theo từng dòng họ.
 *
 * Đây là con số dính tới TIỀN CỦA NỀN TẢNG, không phải cấu hình nội bộ
 * của dòng họ — nên trưởng họ không được tự sửa, y như max_persons.
 * Policy UPDATE của bảng `clans` cho phép trưởng họ ghi (họ cần đổi tên,
 * mô tả…), nên thứ chặn thật là trigger protect_clan_privileged_cols.
 * Quên thêm cột mới vào trigger đó là lỗ hổng im lặng: RLS vẫn "pass".
 */
describe("RLS: hạn mức AI theo dòng họ", () => {
  const admin = adminClient();
  let owner: TestUser;
  let boss: TestUser;
  let clanId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "LimitOwner" });
    boss = await createTestUser({
      displayName: "LimitAdmin",
      isPlatformAdmin: true,
    });
    clanId = await createTestClan(owner, { name: "Họ Hạn Mức" });
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(boss.id);
  });

  it("mặc định là NULL — nghĩa là theo mức chung, không phải không giới hạn", async () => {
    const { data } = await admin
      .from("clans")
      .select("ai_daily_limit, ai_monthly_limit")
      .eq("id", clanId)
      .single();
    expect(data?.ai_daily_limit).toBeNull();
    expect(data?.ai_monthly_limit).toBeNull();
  });

  it("trưởng họ KHÔNG tự nới trần cho dòng họ mình được", async () => {
    const { error } = await owner.client
      .from("clans")
      .update({ ai_daily_limit: 99999 })
      .eq("id", clanId);
    expect(error?.message).toMatch(/ai_daily_limit/i);

    const { data } = await admin
      .from("clans")
      .select("ai_daily_limit")
      .eq("id", clanId)
      .single();
    expect(data?.ai_daily_limit).toBeNull();
  });

  it("trưởng họ cũng không sửa được trần tháng", async () => {
    const { error } = await owner.client
      .from("clans")
      .update({ ai_monthly_limit: 5000 })
      .eq("id", clanId);
    expect(error?.message).toMatch(/ai_monthly_limit/i);
  });

  it("trưởng họ vẫn sửa được những thứ của mình (không chặn nhầm)", async () => {
    const { error } = await owner.client
      .from("clans")
      .update({ description: "Mô tả mới" })
      .eq("id", clanId);
    expect(error).toBeNull();
  });

  it("platform admin đặt được mức riêng, kể cả 0 = khoá hẳn", async () => {
    const { error } = await boss.client
      .from("clans")
      .update({ ai_daily_limit: 0, ai_monthly_limit: 500 })
      .eq("id", clanId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("clans")
      .select("ai_daily_limit, ai_monthly_limit")
      .eq("id", clanId)
      .single();
    // 0 phải lưu được thành 0, KHÔNG bị hiểu thành "chưa đặt".
    expect(data?.ai_daily_limit).toBe(0);
    expect(data?.ai_monthly_limit).toBe(500);
  });

  it("xoá mức riêng bằng cách đặt lại NULL", async () => {
    await boss.client
      .from("clans")
      .update({ ai_daily_limit: null })
      .eq("id", clanId);
    const { data } = await admin
      .from("clans")
      .select("ai_daily_limit")
      .eq("id", clanId)
      .single();
    expect(data?.ai_daily_limit).toBeNull();
  });

  it("từ chối số âm — trần âm là vô nghĩa và sẽ khoá im lặng", async () => {
    const { error } = await boss.client
      .from("clans")
      .update({ ai_daily_limit: -5 })
      .eq("id", clanId);
    expect(error).not.toBeNull();
  });
});
