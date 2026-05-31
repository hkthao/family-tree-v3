import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminAction,
  listAllClans,
  listAllProfiles,
  listClansForUser,
  updateClanLimits,
  updateProfileMaxClans,
} from "@/lib/queries/admin";
import { createClan } from "@/lib/queries/clans";

import {
  adminClient,
  createTestUser,
  type TestUser,
} from "../supabase-helpers";

describe("platform admin /admin queries + admin-action edge function", () => {
  let pa: TestUser;
  let alice: TestUser;
  const cleanup: string[] = [];

  beforeAll(async () => {
    pa = await createTestUser({
      displayName: "PlatformAdmin",
      isPlatformAdmin: true,
      maxClans: 5,
    });
    alice = await createTestUser({ displayName: "Alice", maxClans: 1 });
    cleanup.push(pa.id, alice.id);

    await createClan({ name: "Alice clan" }, alice.id, alice.client);
  });

  afterAll(async () => {
    for (const id of cleanup) {
      try {
        await adminClient().auth.admin.deleteUser(id);
      } catch {
        /* ignore — may already be gone */
      }
    }
  });

  it("listAllProfiles returns rows + emails for platform admin", async () => {
    const all = await listAllProfiles(pa.client);
    const aliceRow = all.find((p) => p.id === alice.id);
    expect(aliceRow?.email).toBe(alice.email);
    expect(aliceRow?.is_suspended).toBe(false);
    expect(aliceRow?.is_platform_admin).toBe(false);
  });

  it("non-platform-admin gets only their own row on listAllProfiles", async () => {
    const own = await listAllProfiles(alice.client);
    expect(own.map((p) => p.id)).toEqual([alice.id]);
  });

  it("listAllClans returns the clan Alice owns", async () => {
    const clans = await listAllClans(pa.client);
    expect(clans.some((c) => c.name === "Alice clan")).toBe(true);
  });

  it("listClansForUser includes role info", async () => {
    const list = await listClansForUser(alice.id, pa.client);
    expect(list[0].role).toBe("admin");
    expect(list[0].clan_name).toBe("Alice clan");
  });

  it("platform admin can raise max_clans on a user", async () => {
    await updateProfileMaxClans(alice.id, 3, pa.client);
    const profile = (await listAllProfiles(pa.client)).find(
      (p) => p.id === alice.id,
    );
    expect(profile?.max_clans).toBe(3);
  });

  it("non-platform-admin cannot raise their own max_clans (trigger blocks)", async () => {
    await expect(
      updateProfileMaxClans(alice.id, 99, alice.client),
    ).rejects.toThrow(/max_clans/i);
  });

  it("platform admin can adjust clan limits", async () => {
    const c = (await listAllClans(pa.client)).find((x) => x.name === "Alice clan")!;
    await updateClanLimits(c.id, { max_persons: 1000, max_users: 7 }, pa.client);
    const after = (await listAllClans(pa.client)).find((x) => x.id === c.id);
    expect(after?.max_persons).toBe(1000);
    expect(after?.max_users).toBe(7);
  });

  describe("admin-action edge function", () => {
    it("non-platform-admin caller → 403", async () => {
      await expect(
        adminAction(
          { action: "signout", target_user_id: alice.id },
          alice.client,
        ),
      ).rejects.toThrow();
    });

    it("platform admin can suspend + unsuspend", async () => {
      await adminAction(
        { action: "suspend", target_user_id: alice.id },
        pa.client,
      );
      const after = (await listAllProfiles(pa.client)).find(
        (p) => p.id === alice.id,
      );
      expect(after?.is_suspended).toBe(true);

      await adminAction(
        { action: "unsuspend", target_user_id: alice.id },
        pa.client,
      );
      const after2 = (await listAllProfiles(pa.client)).find(
        (p) => p.id === alice.id,
      );
      expect(after2?.is_suspended).toBe(false);
    });

    it("platform admin can grant + revoke is_platform_admin", async () => {
      await adminAction(
        {
          action: "grant_platform_admin",
          target_user_id: alice.id,
          grant: true,
        },
        pa.client,
      );
      let after = (await listAllProfiles(pa.client)).find(
        (p) => p.id === alice.id,
      );
      expect(after?.is_platform_admin).toBe(true);

      await adminAction(
        {
          action: "grant_platform_admin",
          target_user_id: alice.id,
          grant: false,
        },
        pa.client,
      );
      after = (await listAllProfiles(pa.client)).find(
        (p) => p.id === alice.id,
      );
      expect(after?.is_platform_admin).toBe(false);
    });

    it("refuses self-suspend even by platform admin", async () => {
      await expect(
        adminAction(
          { action: "suspend", target_user_id: pa.id },
          pa.client,
        ),
      ).rejects.toThrow(/yourself/i);
    });

    it("delete cascades through profiles", async () => {
      const target = await createTestUser({ displayName: "Doomed" });
      cleanup.push(target.id);
      await adminAction(
        { action: "delete", target_user_id: target.id },
        pa.client,
      );
      const { data } = await adminClient()
        .from("profiles")
        .select("id")
        .eq("id", target.id)
        .maybeSingle();
      expect(data).toBeNull();
    });
  });
});
