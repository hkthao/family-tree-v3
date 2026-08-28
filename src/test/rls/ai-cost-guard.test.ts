import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Ngắt mạch chi phí — ai được nhìn con số vận hành.
 *
 * `ai_spend_today` là SECURITY DEFINER nên nó phải TỰ kiểm quyền: chỉ cấp
 * execute cho `authenticated` mà quên kiểm bên trong là mọi người dùng
 * đăng nhập đều đọc được chi phí vận hành của nền tảng.
 */
describe("RLS: ai_spend_today", () => {
  const admin = adminClient();
  let user: TestUser;
  let boss: TestUser;

  beforeAll(async () => {
    user = await createTestUser({ displayName: "SpendUser" });
    boss = await createTestUser({
      displayName: "SpendAdmin",
      isPlatformAdmin: true,
    });
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await deleteUser(boss.id);
  });

  it("service role đọc được — đây là đường của Edge Function", async () => {
    const { data, error } = await admin.rpc("ai_spend_today");
    expect(error).toBeNull();
    expect(Number(data)).toBeGreaterThanOrEqual(0);
  });

  it("platform admin đọc được — để màn quản trị hiện số", async () => {
    const { error } = await boss.client.rpc("ai_spend_today");
    expect(error).toBeNull();
  });

  it("người dùng thường KHÔNG đọc được chi phí vận hành", async () => {
    const { error } = await user.client.rpc("ai_spend_today");
    expect(error).not.toBeNull();
  });

  it("khách vãng lai không gọi được", async () => {
    const { error } = await anonClient().rpc("ai_spend_today");
    expect(error).not.toBeNull();
  });

  it("người dùng thường vẫn không đọc được bảng ai_usage", async () => {
    const { data } = await user.client.from("ai_usage").select("ip_hash");
    expect(data ?? []).toHaveLength(0);
  });
});
