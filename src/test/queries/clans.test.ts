import { afterAll, describe, expect, it } from "vitest";

import { getClanDetail } from "@/lib/queries/clan-detail";
import {
  createClan,
  listCommunityClans,
  listMyClans,
} from "@/lib/queries/clans";

import { createTestUser, deleteUser } from "../supabase-helpers";

const DEFAULT_PARAMS = { page: 1, pageSize: 50 } as const;

/**
 * Integration tests against the real local Supabase: validate that the
 * query module's public API works end-to-end (RLS + triggers + JOIN shape).
 */
describe("queries: clans", () => {
  const cleanup: string[] = [];

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("listMyClans is empty for a fresh user", async () => {
    const user = await createTestUser({ displayName: "Empty" });
    cleanup.push(user.id);

    const r = await listMyClans(user.id, DEFAULT_PARAMS, user.client);
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("createClan + listMyClans round-trips with role=admin", async () => {
    const user = await createTestUser({ displayName: "Founder" });
    cleanup.push(user.id);

    const { id: clanId } = await createClan(
      { name: "Họ Demo", description: "Test", visibility: "private" },
      user.id,
      user.client,
    );
    expect(clanId).toBeTruthy();

    const r = await listMyClans(user.id, DEFAULT_PARAMS, user.client);
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(1);
    expect(r.rows[0].id).toBe(clanId);
    expect(r.rows[0].role).toBe("admin");
    expect(r.rows[0].visibility).toBe("private");
  });

  it("listMyClans search by unaccent matches diacritics", async () => {
    const user = await createTestUser({ displayName: "Searcher", maxClans: 3 });
    cleanup.push(user.id);
    await createClan({ name: "Họ Nguyễn" }, user.id, user.client);
    await createClan({ name: "Họ Trần" }, user.id, user.client);

    const r = await listMyClans(
      user.id,
      { ...DEFAULT_PARAMS, search: "nguyen" },
      user.client,
    );
    expect(r.total).toBe(1);
    expect(r.rows[0].name).toBe("Họ Nguyễn");
  });

  it("listCommunityClans shows public clans the caller isn't a member of", async () => {
    const owner = await createTestUser({ displayName: "PubOwner" });
    const stranger = await createTestUser({ displayName: "Stranger" });
    cleanup.push(owner.id, stranger.id);
    // Unique name so the search filter narrows the (potentially large)
    // public-clan list down to this row regardless of how much test
    // data has piled up in the local DB.
    const uniqueName = `Public clan ${crypto.randomUUID().slice(0, 8)}`;
    const { id: pub } = await createClan(
      { name: uniqueName, visibility: "public" },
      owner.id,
      owner.client,
    );

    const r = await listCommunityClans(
      stranger.id,
      { ...DEFAULT_PARAMS, search: uniqueName },
      stranger.client,
    );
    expect(r.rows.some((c) => c.id === pub)).toBe(true);
    expect(r.rows.every((c) => c.role === null)).toBe(true);
  });

  it("listCommunityClans hides clans the caller is already a member of", async () => {
    const user = await createTestUser({ displayName: "Joined", maxClans: 2 });
    cleanup.push(user.id);
    const { id: cid } = await createClan(
      { name: "Mine", visibility: "public" },
      user.id,
      user.client,
    );

    const r = await listCommunityClans(user.id, DEFAULT_PARAMS, user.client);
    expect(r.rows.some((c) => c.id === cid)).toBe(false);
  });

  it("getClanDetail returns clan with myRole=admin for owner", async () => {
    const user = await createTestUser({ displayName: "Owner" });
    cleanup.push(user.id);

    const { id: clanId } = await createClan(
      { name: "Họ Detail" },
      user.id,
      user.client,
    );
    const detail = await getClanDetail(clanId, user.id, user.client);

    expect(detail).not.toBeNull();
    expect(detail!.name).toBe("Họ Detail");
    expect(detail!.myRole).toBe("admin");
  });

  it("getClanDetail returns null for non-member of private clan", async () => {
    const owner = await createTestUser({ displayName: "Owner" });
    const outsider = await createTestUser({ displayName: "Outsider" });
    cleanup.push(owner.id, outsider.id);

    const { id: clanId } = await createClan(
      { name: "Private", visibility: "private" },
      owner.id,
      owner.client,
    );
    const detail = await getClanDetail(clanId, outsider.id, outsider.client);
    expect(detail).toBeNull();
  });

  it("createClan rejects when user has reached max_clans", async () => {
    const user = await createTestUser({ displayName: "Limited", maxClans: 1 });
    cleanup.push(user.id);

    await createClan({ name: "First" }, user.id, user.client);

    await expect(
      createClan({ name: "Second" }, user.id, user.client),
    ).rejects.toThrow(/max_clans/i);
  });
});
