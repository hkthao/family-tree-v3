import { afterAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson } from "@/lib/queries/persons";
import {
  countMyBlockingClans,
  deleteMyAccount,
  getMyProfile,
  updateMyDisplayName,
} from "@/lib/queries/profile";

import {
  adminClient,
  createTestUser,
  deleteUser,
} from "../supabase-helpers";

describe("queries: profile + self-delete", () => {
  const cleanup: string[] = [];
  afterAll(async () => {
    for (const id of cleanup) {
      try {
        await deleteUser(id);
      } catch {
        // Already removed by delete_my_account in some tests — ignore.
      }
    }
  });

  it("getMyProfile returns the caller's own row", async () => {
    const u = await createTestUser({ displayName: "Profile User" });
    cleanup.push(u.id);

    const p = await getMyProfile(u.id, u.client);
    expect(p?.id).toBe(u.id);
    expect(p?.display_name).toBe("Profile User");
    expect(p?.is_platform_admin).toBe(false);
  });

  it("updateMyDisplayName persists the new name", async () => {
    const u = await createTestUser({ displayName: "Old Name" });
    cleanup.push(u.id);

    await updateMyDisplayName(u.id, "New Name", u.client);
    const p = await getMyProfile(u.id, u.client);
    expect(p?.display_name).toBe("New Name");
  });

  it("count_my_blocking_clans = 0 when user owns no clan", async () => {
    const u = await createTestUser({ displayName: "Empty Owner" });
    cleanup.push(u.id);
    expect(await countMyBlockingClans(u.client)).toBe(0);
  });

  it("count_my_blocking_clans = 0 when owned clans have no persons", async () => {
    const u = await createTestUser({ displayName: "Owns empty clan" });
    cleanup.push(u.id);
    await createClan({ name: "Empty Clan" }, u.id, u.client);
    expect(await countMyBlockingClans(u.client)).toBe(0);
  });

  it("count_my_blocking_clans counts clans with non-deleted persons", async () => {
    const u = await createTestUser({ displayName: "Owns full clan", maxClans: 2 });
    cleanup.push(u.id);
    const c1 = await createClan({ name: "Clan A" }, u.id, u.client);
    await createPerson(
      { clan_id: c1.id, full_name: "Ai đó", gender: "M" },
      u.client,
    );
    const c2 = await createClan({ name: "Clan B" }, u.id, u.client);
    await createPerson(
      { clan_id: c2.id, full_name: "Ai khác", gender: "F" },
      u.client,
    );
    expect(await countMyBlockingClans(u.client)).toBe(2);
  });

  it("deleteMyAccount rejects when user owns clan with persons", async () => {
    const u = await createTestUser({ displayName: "Stuck Owner" });
    cleanup.push(u.id);
    const c = await createClan({ name: "Stuck" }, u.id, u.client);
    await createPerson(
      { clan_id: c.id, full_name: "Người ở lại", gender: "M" },
      u.client,
    );

    await expect(deleteMyAccount(u.client)).rejects.toThrow(/own/i);

    // Profile + auth.users row still exist
    const admin = adminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", u.id)
      .maybeSingle();
    expect(prof).not.toBeNull();
  });

  it("deleteMyAccount succeeds when no owned clans", async () => {
    const u = await createTestUser({ displayName: "Clean Exit" });
    cleanup.push(u.id);

    await deleteMyAccount(u.client);

    // Profile cascaded away
    const admin = adminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", u.id)
      .maybeSingle();
    expect(prof).toBeNull();

    // auth.users row also gone
    const { data: authUser } = await admin.auth.admin.getUserById(u.id);
    expect(authUser.user).toBeNull();
  });

  it("deleteMyAccount succeeds when owned clan has no persons", async () => {
    const u = await createTestUser({ displayName: "Owner of empty" });
    cleanup.push(u.id);
    await createClan({ name: "Will be orphaned" }, u.id, u.client);

    await deleteMyAccount(u.client);

    // Clan still exists but owner_id is null (FK SET NULL)
    const admin = adminClient();
    const { data: clans } = await admin
      .from("clans")
      .select("id, owner_id, name")
      .eq("name", "Will be orphaned");
    expect(clans?.length).toBe(1);
    expect(clans?.[0].owner_id).toBeNull();
  });
});
