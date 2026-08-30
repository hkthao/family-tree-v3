import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Báo cáo trợ lý AI — ai được nhìn.
 *
 * Mấy hàm này là `security definer`, tức chạy bằng quyền chủ hàm chứ
 * không phải quyền người gọi. Chỉ `grant execute to authenticated` mà
 * quên kiểm bên trong là **mọi người dùng đăng nhập đọc được doanh số
 * vận hành, chi phí, và danh sách dòng họ tiêu nhiều nhất**. Test này
 * đi qua từng hàm chứ không chỉ một hàm mẫu: quên guard ở một hàm mới
 * thêm là kiểu lỗi hay xảy ra nhất.
 */

const FUNCTIONS: Array<[string, Record<string, unknown>]> = [
  ["ai_usage_overview", { p_days: 30 }],
  ["ai_usage_daily", { p_days: 30 }],
  ["ai_usage_by_model", { p_days: 30 }],
  ["ai_usage_by_clan", { p_days: 30 }],
  ["credit_overview", {}],
];

describe("RLS: báo cáo trợ lý AI", () => {
  let user: TestUser;
  let boss: TestUser;

  beforeAll(async () => {
    user = await createTestUser({ displayName: "ReportUser" });
    boss = await createTestUser({
      displayName: "ReportAdmin",
      isPlatformAdmin: true,
    });
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await deleteUser(boss.id);
  });

  it.each(FUNCTIONS)("%s: platform admin đọc được", async (fn, args) => {
    const { error } = await boss.client.rpc(
      fn as "ai_usage_overview",
      args as never,
    );
    expect(error).toBeNull();
  });

  it.each(FUNCTIONS)("%s: người dùng thường KHÔNG đọc được", async (fn, args) => {
    const { error } = await user.client.rpc(
      fn as "ai_usage_overview",
      args as never,
    );
    expect(error).not.toBeNull();
  });

  it.each(FUNCTIONS)("%s: khách vãng lai KHÔNG gọi được", async (fn, args) => {
    const { error } = await anonClient().rpc(
      fn as "ai_usage_overview",
      args as never,
    );
    expect(error).not.toBeNull();
  });

  it("service role đọc được — đường của Edge Function và job nội bộ", async () => {
    const { error } = await adminClient().rpc("ai_usage_overview", {
      p_days: 7,
    });
    expect(error).toBeNull();
  });

  it("chặn khoảng ngày vô lý thay vì quét cả bảng", async () => {
    // p_days = 100000 mà không chặn thì mỗi lần mở màn hình là một lần
    // quét toàn bộ ai_usage.
    const { data, error } = await boss.client.rpc("ai_usage_overview", {
      p_days: 100_000,
    });
    expect(error).toBeNull();
    expect((data as unknown as { days: number }).days).toBeLessThanOrEqual(365);
  });
});
