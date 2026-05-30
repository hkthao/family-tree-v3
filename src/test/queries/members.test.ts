import { afterAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { updateClan } from "@/lib/queries/clan-update";
import {
  changeMemberRole,
  inviteMemberByEmail,
  listClanMembers,
  removeMember,
} from "@/lib/queries/members";

import { createTestUser, deleteUser } from "../supabase-helpers";

describe("queries: members & clan settings", () => {
  const cleanup: string[] = [];

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("listClanMembers returns the owner immediately after createClan", async () => {
    const owner = await createTestUser({ displayName: "Owner X" });
    cleanup.push(owner.id);
    const { id: clanId } = await createClan({ name: "T" }, owner.id, owner.client);

    const members = await listClanMembers(clanId, owner.client);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("admin");
    expect(members[0].display_name).toBe("Owner X");
  });

  it("inviteMemberByEmail adds an existing user and bumps the member list", async () => {
    const owner = await createTestUser({ displayName: "Inviter", maxClans: 1 });
    const invitee = await createTestUser({ displayName: "Invitee" });
    cleanup.push(owner.id, invitee.id);
    const { id: clanId } = await createClan({ name: "Inv" }, owner.id, owner.client);

    const res = await inviteMemberByEmail(
      clanId,
      invitee.email,
      "editor",
      owner.client,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user_id).toBe(invitee.id);
      expect(res.role).toBe("editor");
    }

    const members = await listClanMembers(clanId, owner.client);
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.user_id === invitee.id)?.role).toBe("editor");
  });

  it("inviteMemberByEmail returns user_not_found for unknown email", async () => {
    const owner = await createTestUser({ displayName: "Solo" });
    cleanup.push(owner.id);
    const { id: clanId } = await createClan({ name: "U" }, owner.id, owner.client);

    const res = await inviteMemberByEmail(
      clanId,
      "ghost@nope.test",
      "viewer",
      owner.client,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("user_not_found");
  });

  it("inviteMemberByEmail returns already_member on duplicate", async () => {
    const owner = await createTestUser({ displayName: "Owner D" });
    const u = await createTestUser({ displayName: "Twice" });
    cleanup.push(owner.id, u.id);
    const { id: clanId } = await createClan({ name: "D" }, owner.id, owner.client);

    await inviteMemberByEmail(clanId, u.email, "viewer", owner.client);
    const res = await inviteMemberByEmail(clanId, u.email, "editor", owner.client);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("already_member");
  });

  it("non-admin cannot invite (RPC raises)", async () => {
    const owner = await createTestUser({ displayName: "Owner E" });
    const editor = await createTestUser({ displayName: "Editor" });
    const stranger = await createTestUser({ displayName: "Stranger" });
    cleanup.push(owner.id, editor.id, stranger.id);

    const { id: clanId } = await createClan({ name: "E" }, owner.id, owner.client);
    await inviteMemberByEmail(clanId, editor.email, "editor", owner.client);

    await expect(
      inviteMemberByEmail(clanId, stranger.email, "viewer", editor.client),
    ).rejects.toThrow();
  });

  it("changeMemberRole + removeMember work for admin via RLS", async () => {
    const owner = await createTestUser({ displayName: "O" });
    const v = await createTestUser({ displayName: "Vi" });
    cleanup.push(owner.id, v.id);

    const { id: clanId } = await createClan({ name: "R" }, owner.id, owner.client);
    await inviteMemberByEmail(clanId, v.email, "viewer", owner.client);

    await changeMemberRole(clanId, v.id, "editor", owner.client);
    let members = await listClanMembers(clanId, owner.client);
    expect(members.find((m) => m.user_id === v.id)?.role).toBe("editor");

    await removeMember(clanId, v.id, owner.client);
    members = await listClanMembers(clanId, owner.client);
    expect(members.find((m) => m.user_id === v.id)).toBeUndefined();
  });

  it("updateClan changes name + visibility for admin", async () => {
    const owner = await createTestUser({ displayName: "O2" });
    cleanup.push(owner.id);
    const { id: clanId } = await createClan(
      { name: "Before", visibility: "private" },
      owner.id,
      owner.client,
    );

    await updateClan(
      clanId,
      { name: "After", visibility: "public", description: "x" },
      owner.client,
    );

    const { data } = await owner.client
      .from("clans")
      .select("name, visibility, description")
      .eq("id", clanId)
      .single();
    expect(data?.name).toBe("After");
    expect(data?.visibility).toBe("public");
    expect(data?.description).toBe("x");
  });

  it("updateClan max_persons attempt by clan admin is blocked by trigger", async () => {
    const owner = await createTestUser({ displayName: "O3" });
    cleanup.push(owner.id);
    const { id: clanId } = await createClan({ name: "MP" }, owner.id, owner.client);

    await expect(
      updateClan(clanId, { name: "ok" } as never, owner.client),
    ).resolves.toBeUndefined(); // legit field works

    // Trying to bump max_persons via raw update should fail
    const { error } = await owner.client
      .from("clans")
      .update({ max_persons: 99999 })
      .eq("id", clanId);
    expect(error?.message).toMatch(/platform admin/i);
  });
});
