import { afterAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { updateClan } from "@/lib/queries/clan-update";
import { createPerson } from "@/lib/queries/persons";
import {
  changeMemberRole,
  inviteMemberByEmail,
  listClanMembers,
  removeMember,
  setMemberSelfVerified,
  setMySelfPerson,
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

  it("setMySelfPerson + setMemberSelfVerified flow", async () => {
    const owner = await createTestUser({ displayName: "LineageOwner" });
    const member = await createTestUser({ displayName: "LineageMember" });
    cleanup.push(owner.id, member.id);
    const { id: clanId } = await createClan({ name: "L" }, owner.id, owner.client);
    // owner invites member as viewer
    await inviteMemberByEmail(clanId, member.email, "viewer", owner.client);
    // owner adds a person to claim
    const p1 = await createPerson(
      { clan_id: clanId, full_name: "Ancestor A", gender: "M" },
      owner.client,
    );
    const p2 = await createPerson(
      { clan_id: clanId, full_name: "Ancestor B", gender: "F" },
      owner.client,
    );

    // Member claims p1 — should work, verified=false
    await setMySelfPerson(clanId, p1.id, member.client);
    let rows = await listClanMembers(clanId, owner.client);
    const m1 = rows.find((r) => r.user_id === member.id)!;
    expect(m1.self_person_id).toBe(p1.id);
    expect(m1.self_person_verified).toBe(false);

    // Admin verifies
    await setMemberSelfVerified(clanId, member.id, true, owner.client);
    rows = await listClanMembers(clanId, owner.client);
    expect(rows.find((r) => r.user_id === member.id)?.self_person_verified).toBe(true);

    // Member changes to p2 — verified should reset to false
    await setMySelfPerson(clanId, p2.id, member.client);
    rows = await listClanMembers(clanId, owner.client);
    const m2 = rows.find((r) => r.user_id === member.id)!;
    expect(m2.self_person_id).toBe(p2.id);
    expect(m2.self_person_verified).toBe(false);

    // Owner claims p1; should succeed (separate user)
    await setMySelfPerson(clanId, p1.id, owner.client);

    // Member tries to also claim p1 — already taken by owner → throws
    await expect(
      setMySelfPerson(clanId, p1.id, member.client),
    ).rejects.toThrow(/đã có/i);

    // Clear claim by passing null
    await setMySelfPerson(clanId, null, member.client);
    rows = await listClanMembers(clanId, owner.client);
    expect(rows.find((r) => r.user_id === member.id)?.self_person_id).toBeNull();
  });

  it("setMySelfPerson lets a platform admin claim on a clan they don't belong to", async () => {
    const owner = await createTestUser({ displayName: "L3 Owner" });
    const platAdmin = await createTestUser({
      displayName: "PlatAdmin",
      isPlatformAdmin: true,
    });
    cleanup.push(owner.id, platAdmin.id);
    const { id: clanId } = await createClan({ name: "L3" }, owner.id, owner.client);
    const p = await createPerson(
      { clan_id: clanId, full_name: "Lineage Root", gender: "M" },
      owner.client,
    );

    // Platform admin is NOT a clan_members row yet — RPC must auto-
    // insert a viewer row and write the claim.
    await setMySelfPerson(clanId, p.id, platAdmin.client);

    const rows = await listClanMembers(clanId, owner.client);
    const row = rows.find((r) => r.user_id === platAdmin.id);
    expect(row).toBeDefined();
    expect(row!.role).toBe("viewer");
    expect(row!.self_person_id).toBe(p.id);
    expect(row!.self_person_verified).toBe(false);
  });

  it("setMySelfPerson rejects non-members of the clan", async () => {
    const owner = await createTestUser({ displayName: "L2 Owner" });
    const stranger = await createTestUser({ displayName: "Stranger" });
    cleanup.push(owner.id, stranger.id);
    const { id: clanId } = await createClan({ name: "L2" }, owner.id, owner.client);
    const p = await createPerson(
      { clan_id: clanId, full_name: "Some Person", gender: "M" },
      owner.client,
    );
    await expect(
      setMySelfPerson(clanId, p.id, stranger.client),
    ).rejects.toThrow();
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
