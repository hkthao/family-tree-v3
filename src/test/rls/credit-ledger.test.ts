import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * RLS cho credit_ledger — sổ cái quyền lợi (GĐ 3).
 *
 * Có tiền là mô hình đe doạ đổi hẳn. Ba thứ phải chắc:
 *  1. Không ai đọc được sổ của người khác (trừ platform admin).
 *  2. Không ai TỰ CẤP lượt cho mình — kể cả bằng cách gọi thẳng RPC.
 *     `credit_grant` là SECURITY DEFINER, tức chạy bằng quyền chủ hàm;
 *     quên revoke một cái là người dùng có nút "cấp thêm lượt cho tôi".
 *  3. View số dư phải tôn trọng RLS (security_invoker) — thiếu tuỳ chọn
 *     đó thì view chạy bằng quyền postgres và ai cũng đọc số dư người khác.
 */

const admin = adminClient();

function denied(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error &&
    (error.code === "42501" ||
      error.code === "PGRST202" || // không có trong schema cache = không gọi được
      /permission denied|row-level security/i.test(error.message ?? ""))
  );
}

describe("RLS: credit_ledger", () => {
  let alice: TestUser;
  let bob: TestUser;
  let boss: TestUser;

  beforeAll(async () => {
    alice = await createTestUser({ displayName: "CreditAlice" });
    bob = await createTestUser({ displayName: "CreditBob" });
    boss = await createTestUser({
      displayName: "CreditAdmin",
      isPlatformAdmin: true,
    });

    // Service role cấp lượt — đúng đường mà Edge Function đi.
    await admin.rpc("credit_grant", {
      p_owner: alice.id,
      p_resource: "ai_request",
      p_amount: 10,
      p_reason: "admin_grant",
      p_ref: "test:alice",
    });
  });

  afterAll(async () => {
    await admin.from("credit_ledger").delete().eq("owner_id", alice.id);
    await admin.from("credit_ledger").delete().eq("owner_id", bob.id);
    await deleteUser(alice.id);
    await deleteUser(bob.id);
    await deleteUser(boss.id);
  });

  it("chính chủ đọc được sổ của mình", async () => {
    const { data, error } = await alice.client
      .from("credit_ledger")
      .select("delta, reason");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].delta).toBe(10);
  });

  it("người khác KHÔNG đọc được sổ của mình", async () => {
    const { data } = await bob.client
      .from("credit_ledger")
      .select("id")
      .eq("owner_id", alice.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("platform admin đọc được để đối soát khi khách khiếu nại", async () => {
    const { data } = await boss.client
      .from("credit_ledger")
      .select("id")
      .eq("owner_id", alice.id);
    expect(data ?? []).toHaveLength(1);
  });

  it("khách vãng lai không đọc được gì", async () => {
    const { data } = await anonClient().from("credit_ledger").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("KHÔNG ai ghi thẳng vào sổ — chỉ RPC security definer viết", async () => {
    const { error } = await alice.client.from("credit_ledger").insert({
      owner_id: alice.id,
      resource: "ai_request",
      delta: 1000,
      reason: "admin_grant",
    });
    expect(denied(error)).toBe(true);
  });

  it("KHÔNG ai sửa hay xoá bút toán cũ — sổ chỉ ghi thêm", async () => {
    const { error: upErr } = await alice.client
      .from("credit_ledger")
      .update({ delta: 999 })
      .eq("owner_id", alice.id);
    const { data: after } = await alice.client
      .from("credit_ledger")
      .select("delta");
    // Không có policy UPDATE/DELETE: hoặc bị chặn, hoặc không khớp dòng nào.
    expect(upErr === null || denied(upErr)).toBe(true);
    expect(after?.[0].delta).toBe(10);
  });

  it("người dùng KHÔNG gọi được credit_grant để tự cấp lượt", async () => {
    const { error } = await alice.client.rpc("credit_grant", {
      p_owner: alice.id,
      p_resource: "ai_request",
      p_amount: 1000,
      p_reason: "admin_grant",
    });
    expect(denied(error)).toBe(true);
  });

  it("người dùng KHÔNG gọi được credit_consume để trừ ví người khác", async () => {
    const { error } = await bob.client.rpc("credit_consume", {
      p_owner: alice.id,
      p_resource: "ai_request",
      p_amount: 5,
      p_ref: "attack",
    });
    expect(denied(error)).toBe(true);
  });

  it("view credit_balance chỉ ra số dư của chính mình", async () => {
    const mine = await alice.client.from("credit_balance").select("balance");
    expect(mine.data?.[0]?.balance).toBe(10);

    // Đây là ca mà security_invoker bảo vệ: thiếu nó thì view chạy bằng
    // quyền postgres và Bob nhìn thấy ví của Alice.
    const theirs = await bob.client
      .from("credit_balance")
      .select("balance")
      .eq("owner_id", alice.id);
    expect(theirs.data ?? []).toHaveLength(0);
  });

  it("credit_my_quota chỉ trả hạn mức của chính người gọi, và cấp lượt free", async () => {
    const { data, error } = await bob.client.rpc("credit_my_quota", {
      p_resource: "ai_request",
    });
    expect(error).toBeNull();
    const quota = data as unknown as {
      balance: number;
      free_this_month: number;
    };
    // Bob chưa được cấp gì, nhưng hàm tự cấp lượt free của tháng.
    expect(quota.balance).toBe(quota.free_this_month);
    expect(quota.free_this_month).toBeGreaterThan(0);
  });

  it("tiêu lượt là ATOMIC: mười lời gọi song song không vượt số dư", async () => {
    // Đây là ca "mở hai tab bấm cùng lúc" mà cách đếm-rồi-mới-ghi thua.
    const calls = Array.from({ length: 10 }, (_, i) =>
      admin.rpc("credit_consume", {
        p_owner: alice.id,
        p_resource: "ai_request",
        p_amount: 3,
        p_ref: `race:${i}`,
      }),
    );
    const results = await Promise.all(calls);
    const ok = results.filter((r) => r.data !== null).length;
    // Số dư 10, mỗi lượt trừ 3 → đúng 3 lời gọi thành công, 7 lần trả null.
    expect(ok).toBe(3);

    const { data } = await alice.client.from("credit_balance").select("balance");
    expect(data?.[0]?.balance).toBe(1);
  });
});
