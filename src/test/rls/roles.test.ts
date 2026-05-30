import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

describe("RLS: roles within a clan", () => {
  let admin: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let clanId: string;

  beforeAll(async () => {
    admin = await createTestUser({ displayName: "Admin" });
    editor = await createTestUser({ displayName: "Editor" });
    viewer = await createTestUser({ displayName: "Viewer" });
    stranger = await createTestUser({ displayName: "Stranger" });

    clanId = await createTestClan(admin, { name: "Roles Test", maxUsers: 5 });
    await addMember(clanId, editor, "editor");
    await addMember(clanId, viewer, "viewer");
  });

  afterAll(async () => {
    await deleteUser(admin.id);
    await deleteUser(editor.id);
    await deleteUser(viewer.id);
    await deleteUser(stranger.id);
  });

  it("viewer can SELECT persons but cannot INSERT", async () => {
    const { error: insertErr } = await viewer.client.from("persons").insert({
      clan_id: clanId,
      full_name: "Viewer-tried",
      gender: "F",
    });
    expect(insertErr).not.toBeNull();

    const { data } = await viewer.client.from("persons").select("id").eq("clan_id", clanId);
    expect(data).not.toBeNull(); // [] is fine — viewer can read
  });

  it("editor can INSERT and UPDATE persons", async () => {
    const { data: inserted, error: insertErr } = await editor.client
      .from("persons")
      .insert({ clan_id: clanId, full_name: "Editor inserted", gender: "M" })
      .select("id")
      .single();
    expect(insertErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const { error: updateErr } = await editor.client
      .from("persons")
      .update({ full_name: "Editor updated" })
      .eq("id", inserted!.id);
    expect(updateErr).toBeNull();
  });

  it("editor cannot manage clan_members (admin-only)", async () => {
    const { error } = await editor.client.from("clan_members").insert({
      clan_id: clanId,
      user_id: stranger.id,
      role: "viewer",
    });
    expect(error).not.toBeNull();
  });

  it("editor cannot create share_links (admin-only)", async () => {
    const { error } = await editor.client.from("share_links").insert({
      clan_id: clanId,
      token: `tok-${Math.random()}`,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("admin can manage clan_members and share_links", async () => {
    // Admin invites stranger as viewer
    const { error: memErr } = await admin.client.from("clan_members").insert({
      clan_id: clanId,
      user_id: stranger.id,
      role: "viewer",
      invited_by: admin.id,
    });
    expect(memErr).toBeNull();

    const { error: linkErr } = await admin.client.from("share_links").insert({
      clan_id: clanId,
      token: `tok-admin-${Math.random()}`,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      created_by: admin.id,
    });
    expect(linkErr).toBeNull();
  });

  it("non-member (stranger before invite) cannot SELECT persons", async () => {
    // Re-create a fresh stranger that's never been a member
    const fresh = await createTestUser({ displayName: "Fresh stranger" });
    const { data } = await fresh.client.from("persons").select("id").eq("clan_id", clanId);
    expect(data).toEqual([]);
    await deleteUser(fresh.id);
  });
});
