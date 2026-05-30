import { afterAll, describe, expect, it } from "vitest";

import {
  addMember,
  adminClient,
  createTestClan,
  createTestUser,
  deleteUser,
} from "../supabase-helpers";

describe("RLS: suspended account loses access", () => {
  const cleanup: string[] = [];

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("suspended member sees no persons even if previously had access", async () => {
    const owner = await createTestUser({ displayName: "Owner" });
    const member = await createTestUser({ displayName: "Member" });
    cleanup.push(owner.id, member.id);

    const clanId = await createTestClan(owner);
    await addMember(clanId, member, "editor");

    await owner.client.from("persons").insert({
      clan_id: clanId,
      full_name: "Visible person",
      gender: "M",
      is_root: true,
    });

    // Sanity: member sees the person
    const { data: before } = await member.client.from("persons").select("id").eq("clan_id", clanId);
    expect((before ?? []).length).toBeGreaterThan(0);

    // Suspend
    const admin = adminClient();
    await admin.from("profiles").update({ is_suspended: true }).eq("id", member.id);

    // Member's helper functions now return false → no data visible
    const { data: after } = await member.client.from("persons").select("id").eq("clan_id", clanId);
    expect(after ?? []).toEqual([]);
  });

  it("suspended editor cannot insert persons", async () => {
    const owner = await createTestUser({ displayName: "Owner2" });
    const editor = await createTestUser({ displayName: "Suspended editor" });
    cleanup.push(owner.id, editor.id);

    const clanId = await createTestClan(owner);
    await addMember(clanId, editor, "editor");

    const admin = adminClient();
    await admin.from("profiles").update({ is_suspended: true }).eq("id", editor.id);

    const { error } = await editor.client.from("persons").insert({
      clan_id: clanId,
      full_name: "Tried",
      gender: "F",
    });
    expect(error).not.toBeNull();
  });
});
