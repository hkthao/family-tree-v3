import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listAudit, restoreAuditEntry } from "@/lib/queries/audit";
import { createBranch, updateBranch } from "@/lib/queries/branches";
import { createClan } from "@/lib/queries/clans";
import {
  createPerson,
  deletePerson,
  getPerson,
  updatePerson,
} from "@/lib/queries/persons";

import {
  adminClient,
  createTestUser,
  type TestUser,
} from "../supabase-helpers";

describe("audit log + restore", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let clanId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "AuditOwner" });
    viewer = await createTestUser({ displayName: "AuditViewer" });
    cleanup.push(owner.id, viewer.id);
    const r = await createClan({ name: "Audit clan" }, owner.id, owner.client);
    clanId = r.id;
    await adminClient()
      .from("clan_members")
      .insert({ clan_id: clanId, user_id: viewer.id, role: "viewer" });
  });

  afterAll(async () => {
    for (const id of cleanup) await adminClient().auth.admin.deleteUser(id);
  });

  it("CRUD on persons emits audit rows (insert/update/delete)", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Audit Subject", gender: "M" },
      owner.client,
    );
    await updatePerson(id, { full_name: "Audit Updated" }, owner.client);
    await deletePerson(id, owner.client);

    const log = await listAudit(
      clanId,
      { page: 1, pageSize: 50 },
      owner.client,
    );
    const forThis = log.rows.filter((r) => r.entity_id === id);
    const actions = new Set(forThis.map((r) => r.action));
    // recompute_generation may add an extra implicit update row alongside
    // the user's edit, so we assert presence of each action rather than count.
    expect(actions).toEqual(new Set(["insert", "update", "delete"]));
  });

  it("restore on a soft-deleted person clears deleted_at", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Resurrect Me", gender: "F" },
      owner.client,
    );
    await deletePerson(id, owner.client);
    expect(await getPerson(id, owner.client)).toBeNull();

    const log = await listAudit(
      clanId,
      { page: 1, pageSize: 50, entityType: "person", action: "delete" },
      owner.client,
    );
    const entry = log.rows.find((r) => r.entity_id === id);
    expect(entry).toBeTruthy();
    await restoreAuditEntry(entry!.id, owner.client);

    const back = await getPerson(id, owner.client);
    expect(back?.full_name).toBe("Resurrect Me");
  });

  it("restore on an update writes the before-row back", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Original", gender: "M" },
      owner.client,
    );
    await updatePerson(id, { full_name: "Edited", bio: "new bio" }, owner.client);

    const log = await listAudit(
      clanId,
      { page: 1, pageSize: 50, entityType: "person", action: "update" },
      owner.client,
    );
    const updateRow = log.rows.find((r) => r.entity_id === id);
    expect(updateRow).toBeTruthy();
    await restoreAuditEntry(updateRow!.id, owner.client);

    const after = await getPerson(id, owner.client);
    expect(after?.full_name).toBe("Original");
    expect(after?.bio).toBeNull();
  });

  it("restore on an insert soft-deletes the row", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Will be Un-Inserted", gender: "F" },
      owner.client,
    );
    const log = await listAudit(
      clanId,
      { page: 1, pageSize: 50, entityType: "person", action: "insert" },
      owner.client,
    );
    const entry = log.rows.find((r) => r.entity_id === id);
    await restoreAuditEntry(entry!.id, owner.client);

    expect(await getPerson(id, owner.client)).toBeNull();
  });

  it("restore works on branch updates too", async () => {
    const { id } = await createBranch(
      { clan_id: clanId, name: "Chi gốc" },
      owner.client,
    );
    await updateBranch(id, { name: "Đã đổi tên" }, owner.client);

    const log = await listAudit(
      clanId,
      { page: 1, pageSize: 50, entityType: "branch", action: "update" },
      owner.client,
    );
    const upd = log.rows.find((r) => r.entity_id === id);
    await restoreAuditEntry(upd!.id, owner.client);

    const { data: b } = await owner.client
      .from("branches")
      .select("name")
      .eq("id", id)
      .single();
    expect(b?.name).toBe("Chi gốc");
  });

  it("viewer cannot restore (can_edit_clan blocks)", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Locked", gender: "M" },
      owner.client,
    );
    await deletePerson(id, owner.client);

    const log = await listAudit(
      clanId,
      { page: 1, pageSize: 50, entityType: "person", action: "delete" },
      viewer.client,
    );
    const entry = log.rows.find((r) => r.entity_id === id);
    expect(entry).toBeTruthy();
    await expect(
      restoreAuditEntry(entry!.id, viewer.client),
    ).rejects.toThrow(/Not allowed/i);
  });

  it("non-member sees nothing", async () => {
    const outsider = await createTestUser({ displayName: "Outsider" });
    cleanup.push(outsider.id);
    const r = await listAudit(
      clanId,
      { page: 1, pageSize: 50 },
      outsider.client,
    );
    expect(r.total).toBe(0);
  });
});
