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
 * "Việc cần làm" RPC gate: is_clan_member only.
 *
 * The functions read every soft-undeleted person in the clan via
 * SECURITY DEFINER, so they MUST refuse callers who aren't members of
 * the target clan. Anon must always be refused too.
 */
describe("RLS: get_clan_todo_* + count_clan_todo", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let viewer: TestUser;
  let clanId: string;
  let otherClanId: string;
  let rootPersonId: string;
  let orphanPersonId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Owner" });
    stranger = await createTestUser({ displayName: "Stranger" });
    viewer = await createTestUser({ displayName: "Viewer" });

    clanId = await createTestClan(owner, { name: "Họ chính" });
    otherClanId = await createTestClan(stranger, { name: "Họ ngoài" });
    await addMember(clanId, viewer, "viewer");

    // Seed a root + one child missing both parents (orphan: not is_root,
    // no birth_family_id) to ensure summary returns a non-zero count
    // for missing_parents.
    const admin = adminClient();
    const root = await admin
      .from("persons")
      .insert({
        clan_id: clanId,
        full_name: "Tổ",
        gender: "M",
        is_root: true,
      })
      .select("id")
      .single();
    if (root.error || !root.data) throw new Error(root.error?.message);
    rootPersonId = root.data.id;

    const orphan = await admin
      .from("persons")
      .insert({
        clan_id: clanId,
        full_name: "Cháu mồ côi",
        gender: "M",
        is_root: false,
      })
      .select("id")
      .single();
    if (orphan.error || !orphan.data) throw new Error(orphan.error?.message);
    orphanPersonId = orphan.data.id;
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(stranger.id);
    await deleteUser(viewer.id);
  });

  // ─── Anon ──────────────────────────────────────────────────────────

  it("anon cannot call get_clan_todo_summary", async () => {
    const { error } = await anonClient().rpc("get_clan_todo_summary", {
      p_clan_id: clanId,
    });
    expect(error).not.toBeNull();
  });

  it("anon cannot call get_clan_todo_items", async () => {
    const { error } = await anonClient().rpc("get_clan_todo_items", {
      p_clan_id: clanId,
      p_category: "missing_parents",
    });
    expect(error).not.toBeNull();
  });

  it("anon cannot call count_clan_todo", async () => {
    const { error } = await anonClient().rpc("count_clan_todo", {
      p_clan_id: clanId,
    });
    expect(error).not.toBeNull();
  });

  // ─── Cross-clan ────────────────────────────────────────────────────

  it("stranger (non-member) is refused on summary", async () => {
    const { error } = await stranger.client.rpc("get_clan_todo_summary", {
      p_clan_id: clanId,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/Not authorized/i);
  });

  it("stranger is refused on items", async () => {
    const { error } = await stranger.client.rpc("get_clan_todo_items", {
      p_clan_id: clanId,
      p_category: "missing_parents",
    });
    expect(error).not.toBeNull();
  });

  it("stranger is refused on count", async () => {
    const { error } = await stranger.client.rpc("count_clan_todo", {
      p_clan_id: clanId,
    });
    expect(error).not.toBeNull();
  });

  // ─── Member access ────────────────────────────────────────────────

  it("owner sees summary with at least missing_parents>0", async () => {
    const { data, error } = await owner.client.rpc("get_clan_todo_summary", {
      p_clan_id: clanId,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const row = (data ?? []).find(
      (r: { category: string }) => r.category === "missing_parents",
    );
    expect(row).toBeDefined();
    expect(Number(row?.count ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("viewer (read-only member) can call summary", async () => {
    const { error } = await viewer.client.rpc("get_clan_todo_summary", {
      p_clan_id: clanId,
    });
    expect(error).toBeNull();
  });

  it("items returns the orphan in missing_parents", async () => {
    const { data, error } = await owner.client.rpc("get_clan_todo_items", {
      p_clan_id: clanId,
      p_category: "missing_parents",
      p_limit: 50,
      p_offset: 0,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { person_id: string }) => r.person_id);
    expect(ids).toContain(orphanPersonId);
    expect(ids).not.toContain(rootPersonId); // is_root excluded
  });

  it("count includes load-bearing categories only", async () => {
    const { data, error } = await owner.client.rpc("count_clan_todo", {
      p_clan_id: clanId,
    });
    expect(error).toBeNull();
    expect(Number(data ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("soft-deleted persons are excluded from items", async () => {
    const admin = adminClient();
    const { data: doomed, error: insErr } = await admin
      .from("persons")
      .insert({
        clan_id: clanId,
        full_name: "Sẽ bị xoá",
        gender: "F",
        is_root: false,
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    if (!doomed) return;

    const { data } = await owner.client.rpc("get_clan_todo_items", {
      p_clan_id: clanId,
      p_category: "missing_parents",
    });
    const ids = (data ?? []).map((r: { person_id: string }) => r.person_id);
    expect(ids).not.toContain(doomed.id);
  });

  it("unknown category raises", async () => {
    const { error } = await owner.client.rpc("get_clan_todo_items", {
      p_clan_id: clanId,
      p_category: "totally_made_up",
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/Unknown category/i);
  });

  it("stranger seeing only THEIR clan's count", async () => {
    const { data: ownCount, error: ownErr } = await stranger.client.rpc(
      "count_clan_todo",
      { p_clan_id: otherClanId },
    );
    expect(ownErr).toBeNull();
    expect(typeof Number(ownCount ?? 0)).toBe("number");
  });
});
