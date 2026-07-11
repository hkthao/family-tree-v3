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

describe("RLS: honor_entries (Sổ vàng công đức)", () => {
  let owner: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let clanId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "HonorOwner" });
    editor = await createTestUser({ displayName: "HonorEditor" });
    viewer = await createTestUser({ displayName: "HonorViewer" });
    stranger = await createTestUser({ displayName: "HonorStranger" });
    clanId = await createTestClan(owner, { name: "Họ Sổ Vàng" });
    await addMember(clanId, editor, "editor");
    await addMember(clanId, viewer, "viewer");
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(editor.id);
    await deleteUser(viewer.id);
    await deleteUser(stranger.id);
  });

  it("editor CAN insert an honor entry", async () => {
    const { error } = await editor.client.from("honor_entries").insert({
      clan_id: clanId,
      honoree_name: "Cụ Lê Văn A",
      category: "donation_money",
      amount: 2_000_000,
      note: "Ủng hộ xây từ đường",
    });
    expect(error).toBeNull();
  });

  it("viewer CANNOT insert (not can_edit_clan)", async () => {
    const { error } = await viewer.client.from("honor_entries").insert({
      clan_id: clanId,
      honoree_name: "Tôi tự thêm",
      category: "other",
    });
    expect(rlsBlocked(error)).toBe(true);
  });

  it("member (viewer) CAN read the clan's entries", async () => {
    const { data, error } = await viewer.client
      .from("honor_entries")
      .select("id, honoree_name")
      .eq("clan_id", clanId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("stranger (non-member) sees no rows", async () => {
    const { data, error } = await stranger.client
      .from("honor_entries")
      .select("id")
      .eq("clan_id", clanId);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("anon cannot read", async () => {
    const { data } = await anonClient()
      .from("honor_entries")
      .select("id")
      .eq("clan_id", clanId);
    expect(data ?? []).toEqual([]);
  });

  it("editor CAN soft-delete; viewer CANNOT", async () => {
    const { data: rows } = await editor.client
      .from("honor_entries")
      .select("id")
      .eq("clan_id", clanId)
      .limit(1);
    const id = rows?.[0]?.id;
    expect(id).toBeTruthy();

    // viewer update blocked (no rows affected / error)
    const { error: vErr, count: vCount } = await viewer.client
      .from("honor_entries")
      .update({ note: "hack" }, { count: "exact" })
      .eq("id", id!);
    expect(rlsBlocked(vErr) || (vCount ?? 0) === 0).toBe(true);

    // editor soft-delete OK
    const { error: eErr } = await editor.client
      .from("honor_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id!);
    expect(eErr).toBeNull();
  });
});
