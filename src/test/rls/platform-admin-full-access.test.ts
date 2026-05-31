import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { listAudit } from "@/lib/queries/audit";
import { createBranch } from "@/lib/queries/branches";
import { listShareLinks, createShareLink } from "@/lib/queries/share-links";
import {
  createPerson,
  deletePerson,
  getPerson,
  listPersons,
  updatePerson,
} from "@/lib/queries/persons";

import {
  adminClient,
  createTestUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Platform admin gets clan-admin equivalent access to every clan, without
 * being added to clan_members. This verifies the helper functions and the
 * policies that depend on them grant full read + write + management.
 */
describe("RLS: platform admin has full access to all clans", () => {
  let owner: TestUser;
  let pa: TestUser;
  let clanId: string;
  let aliveId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Regular Owner" });
    pa = await createTestUser({
      displayName: "FullAccess Admin",
      isPlatformAdmin: true,
    });
    cleanup.push(owner.id, pa.id);

    const r = await createClan(
      { name: "Owner's private clan", visibility: "private" },
      owner.id,
      owner.client,
    );
    clanId = r.id;
    const p = await createPerson(
      { clan_id: clanId, full_name: "Owner-Only Person", gender: "M" },
      owner.client,
    );
    aliveId = p.id;
  });

  afterAll(async () => {
    for (const id of cleanup) {
      try {
        await adminClient().auth.admin.deleteUser(id);
      } catch {
        /* ignore */
      }
    }
  });

  it("can read persons in a clan they are not a member of", async () => {
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 50 },
      pa.client,
    );
    expect(r.total).toBe(1);
    expect(r.rows[0].id).toBe(aliveId);
  });

  it("can INSERT persons in any clan", async () => {
    const created = await createPerson(
      { clan_id: clanId, full_name: "Created By Platform Admin", gender: "F" },
      pa.client,
    );
    const fetched = await getPerson(created.id, pa.client);
    expect(fetched?.full_name).toBe("Created By Platform Admin");
  });

  it("can UPDATE persons in any clan", async () => {
    await updatePerson(aliveId, { full_name: "Renamed by PA" }, pa.client);
    const after = await getPerson(aliveId, owner.client);
    expect(after?.full_name).toBe("Renamed by PA");
  });

  it("can DELETE (soft) persons in any clan", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Doomed by PA", gender: "M" },
      owner.client,
    );
    await deletePerson(id, pa.client);
    expect(await getPerson(id, pa.client)).toBeNull();
  });

  it("can manage branches in any clan", async () => {
    const b = await createBranch(
      { clan_id: clanId, name: "PA branch" },
      pa.client,
    );
    expect(b.id).toBeTruthy();
  });

  it("can read the audit log of any clan", async () => {
    const r = await listAudit(
      clanId,
      { page: 1, pageSize: 10 },
      pa.client,
    );
    expect(r.total).toBeGreaterThan(0);
  });

  it("can create + list share-links for any clan", async () => {
    const link = await createShareLink(
      { clan_id: clanId, ttlDays: 7 },
      pa.client,
    );
    const all = await listShareLinks(clanId, pa.client);
    expect(all.some((l) => l.id === link.id)).toBe(true);
  });

  it("suspended platform admin loses the override", async () => {
    const banned = await createTestUser({
      displayName: "Suspended PA",
      isPlatformAdmin: true,
      isSuspended: true,
    });
    cleanup.push(banned.id);
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 10 },
      banned.client,
    );
    // is_platform_admin() now returns false when suspended → policy denies
    // SELECT → empty result.
    expect(r.total).toBe(0);
  });
});
