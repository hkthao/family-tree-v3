import { afterAll, describe, expect, it } from "vitest";

import { createClan, listMyClans } from "@/lib/queries/clans";

import { createTestUser, deleteUser } from "../supabase-helpers";

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

    const clans = await listMyClans(user.id, user.client);
    expect(clans).toEqual([]);
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

    const clans = await listMyClans(user.id, user.client);
    expect(clans).toHaveLength(1);
    expect(clans[0].id).toBe(clanId);
    expect(clans[0].role).toBe("admin");
    expect(clans[0].visibility).toBe("private");
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
