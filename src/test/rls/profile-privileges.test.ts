import { afterAll, describe, expect, it } from "vitest";

import { createTestUser, deleteUser } from "../supabase-helpers";

describe("RLS + trigger: profile privilege escalation prevention", () => {
  const cleanup: string[] = [];

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("normal user cannot raise their own max_clans", async () => {
    const u = await createTestUser({ displayName: "Wanna-be" });
    cleanup.push(u.id);

    const { error } = await u.client
      .from("profiles")
      .update({ max_clans: 999 })
      .eq("id", u.id);
    expect(error?.message).toMatch(/platform admin/i);
  });

  it("normal user cannot grant themselves platform admin", async () => {
    const u = await createTestUser({ displayName: "Pretender" });
    cleanup.push(u.id);

    const { error } = await u.client
      .from("profiles")
      .update({ is_platform_admin: true })
      .eq("id", u.id);
    expect(error?.message).toMatch(/platform admin/i);
  });

  it("normal user cannot un-suspend themselves", async () => {
    const u = await createTestUser({ displayName: "Locked", isSuspended: true });
    cleanup.push(u.id);

    const { error } = await u.client
      .from("profiles")
      .update({ is_suspended: false })
      .eq("id", u.id);
    expect(error?.message).toMatch(/platform admin/i);
  });

  it("user CAN update their own display_name", async () => {
    const u = await createTestUser({ displayName: "Original" });
    cleanup.push(u.id);

    const { error } = await u.client
      .from("profiles")
      .update({ display_name: "Renamed" })
      .eq("id", u.id);
    expect(error).toBeNull();
  });

  it("platform admin CAN change max_clans on any profile", async () => {
    const admin = await createTestUser({ displayName: "PA", isPlatformAdmin: true });
    const target = await createTestUser({ displayName: "Target" });
    cleanup.push(admin.id, target.id);

    const { error } = await admin.client
      .from("profiles")
      .update({ max_clans: 5 })
      .eq("id", target.id);
    expect(error).toBeNull();
  });
});
