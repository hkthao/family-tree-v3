import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

function rlsBlocked(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error &&
    (error.code === "42501" || /row-level security/i.test(error.message ?? ""))
  );
}

describe("RLS: fund_transactions + fund_audit (Quỹ họ minh bạch)", () => {
  let owner: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let clanId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "FundOwner" });
    editor = await createTestUser({ displayName: "FundEditor" });
    viewer = await createTestUser({ displayName: "FundViewer" });
    stranger = await createTestUser({ displayName: "FundStranger" });
    clanId = await createTestClan(owner, { name: "Họ Quỹ" });
    await addMember(clanId, editor, "editor");
    await addMember(clanId, viewer, "viewer");
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(editor.id);
    await deleteUser(viewer.id);
    await deleteUser(stranger.id);
  });

  it("editor CAN record a transaction; viewer CANNOT", async () => {
    const { error: eErr } = await editor.client.from("fund_transactions").insert({
      clan_id: clanId,
      direction: "in",
      amount: 500_000,
      fund: "Quỹ chung",
      category: "Đóng góp giỗ tổ",
    });
    expect(eErr).toBeNull();

    const { error: vErr } = await viewer.client.from("fund_transactions").insert({
      clan_id: clanId,
      direction: "out",
      amount: 100_000,
      fund: "Quỹ chung",
    });
    expect(rlsBlocked(vErr)).toBe(true);
  });

  it("rejects non-positive amount", async () => {
    const { error } = await editor.client.from("fund_transactions").insert({
      clan_id: clanId,
      direction: "in",
      amount: 0,
      fund: "Quỹ chung",
    });
    expect(error).not.toBeNull();
  });

  it("member CAN read; stranger + anon see nothing", async () => {
    const { data: vData, error: vErr } = await viewer.client
      .from("fund_transactions")
      .select("id, amount")
      .eq("clan_id", clanId);
    expect(vErr).toBeNull();
    expect((vData ?? []).length).toBeGreaterThan(0);

    const { data: sData } = await stranger.client
      .from("fund_transactions")
      .select("id")
      .eq("clan_id", clanId);
    expect(sData ?? []).toEqual([]);

    const { data: aData } = await anonClient()
      .from("fund_transactions")
      .select("id")
      .eq("clan_id", clanId);
    expect(aData ?? []).toEqual([]);
  });

  it("AUDIT auto-records the insert with the actor's name", async () => {
    const { data, error } = await viewer.client
      .from("fund_audit")
      .select("action, actor_name, amount")
      .eq("clan_id", clanId)
      .eq("action", "insert")
      .order("at", { ascending: false });
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBeGreaterThan(0);
    // Giao dịch đầu do editor tạo → actor_name = tên editor.
    expect(rows.some((r) => r.actor_name === "FundEditor")).toBe(true);
  });

  it("AUDIT records a soft-delete as action='delete'", async () => {
    const { data: rows } = await editor.client
      .from("fund_transactions")
      .select("id")
      .eq("clan_id", clanId)
      .limit(1);
    const id = rows?.[0]?.id;
    expect(id).toBeTruthy();

    const { error } = await editor.client
      .from("fund_transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id!);
    expect(error).toBeNull();

    const { data: del } = await editor.client
      .from("fund_audit")
      .select("action, txn_id")
      .eq("clan_id", clanId)
      .eq("action", "delete");
    expect((del ?? []).some((r) => r.txn_id === id)).toBe(true);
  });

  it("nobody can write fund_audit directly (append-only via trigger)", async () => {
    const { error } = await editor.client.from("fund_audit").insert({
      clan_id: clanId,
      action: "insert",
      amount: 999,
    });
    expect(rlsBlocked(error)).toBe(true);
  });

  it("stranger cannot read fund_audit", async () => {
    const { data } = await stranger.client
      .from("fund_audit")
      .select("id")
      .eq("clan_id", clanId);
    expect(data ?? []).toEqual([]);
  });
});
