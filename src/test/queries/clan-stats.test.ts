import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getClanStats } from "@/lib/queries/clan-stats";
import { createClan } from "@/lib/queries/clans";
import { createPerson, deletePerson } from "@/lib/queries/persons";

import {
  addMember,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

describe("queries: clan-stats", () => {
  let owner: TestUser;
  let outsider: TestUser;
  let clanId: string;
  let firstPersonId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "StatsOwner", maxClans: 1 });
    outsider = await createTestUser({ displayName: "Outsider" });
    cleanup.push(owner.id, outsider.id);

    const r = await createClan({ name: "Stats Clan" }, owner.id, owner.client);
    clanId = r.id;

    // Persons of mixed gender + living status + one root.
    const seeds: Array<{ name: string; gender: "M" | "F"; root?: boolean; living: boolean }> = [
      { name: "Root M", gender: "M", root: true, living: false },
      { name: "Child 1 M", gender: "M", living: true },
      { name: "Child 2 F", gender: "F", living: true },
      { name: "Sibling F", gender: "F", living: false },
    ];
    let i = 0;
    for (const s of seeds) {
      const p = await createPerson(
        {
          clan_id: clanId,
          full_name: s.name,
          gender: s.gender,
          is_root: s.root,
          is_living: s.living,
        },
        owner.client,
      );
      if (i++ === 0) firstPersonId = p.id;
    }
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("counts persons by gender + living status + total", async () => {
    const s = await getClanStats(clanId, owner.client);
    expect(s.total_persons).toBe(4);
    expect(s.males).toBe(2);
    expect(s.females).toBe(2);
    expect(s.living).toBe(2);
    expect(s.deceased).toBe(2);
  });

  it("returns max(generation) — at least the root's generation", async () => {
    const s = await getClanStats(clanId, owner.client);
    // Only the root has a known generation (1) — others have null
    // unless connected through families, which this test doesn't set up.
    expect(s.max_generation).toBe(1);
  });

  it("excludes soft-deleted persons", async () => {
    await deletePerson(firstPersonId, owner.client);
    const s = await getClanStats(clanId, owner.client);
    expect(s.total_persons).toBe(3);
    // The deleted person was the root — so max_generation drops.
    expect(s.max_generation).toBeNull();
  });

  it("returns zeros for a non-member (RLS hides rows)", async () => {
    const s = await getClanStats(clanId, outsider.client);
    expect(s.total_persons).toBe(0);
    expect(s.males).toBe(0);
    expect(s.females).toBe(0);
  });

  it("rejects anonymous callers (RPC execute not granted to anon)", async () => {
    const anon = anonClient();
    await expect(getClanStats(clanId, anon)).rejects.toThrow();
  });

  it("viewer-role member sees full counts", async () => {
    const viewer = await createTestUser({ displayName: "StatsViewer" });
    cleanup.push(viewer.id);
    await addMember(clanId, viewer, "viewer");

    const s = await getClanStats(clanId, viewer.client);
    expect(s.total_persons).toBe(3); // after the soft-delete above
    expect(s.males + s.females).toBe(3);
  });
});
