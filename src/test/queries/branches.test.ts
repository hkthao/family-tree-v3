import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
} from "@/lib/queries/branches";
import { createClan } from "@/lib/queries/clans";
import { createPerson, listPersons } from "@/lib/queries/persons";

import {
  addMember,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

describe("queries: branches", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let clanId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "BranchOwner" });
    viewer = await createTestUser({ displayName: "BranchViewer" });
    cleanup.push(owner.id, viewer.id);
    const r = await createClan({ name: "Branch Clan" }, owner.id, owner.client);
    clanId = r.id;
    await addMember(clanId, viewer, "viewer");
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("listBranches is empty for a new clan", async () => {
    expect(await listBranches(clanId, owner.client)).toEqual([]);
  });

  it("createBranch + listBranches round-trip; sorted by name", async () => {
    await createBranch({ clan_id: clanId, name: "Chi cả" }, owner.client);
    await createBranch({ clan_id: clanId, name: "Chi ba" }, owner.client);
    await createBranch({ clan_id: clanId, name: "Chi hai" }, owner.client);

    const list = await listBranches(clanId, owner.client);
    expect(list.map((b) => b.name)).toEqual(["Chi ba", "Chi cả", "Chi hai"]);
  });

  it("updateBranch changes name", async () => {
    const { id } = await createBranch(
      { clan_id: clanId, name: "Sửa tôi" },
      owner.client,
    );
    await updateBranch(id, { name: "Đã sửa" }, owner.client);
    const list = await listBranches(clanId, owner.client);
    expect(list.find((b) => b.id === id)?.name).toBe("Đã sửa");
  });

  it("deleteBranch soft-deletes (excluded from list)", async () => {
    const { id } = await createBranch(
      { clan_id: clanId, name: "Xoá tôi" },
      owner.client,
    );
    await deleteBranch(id, owner.client);
    const list = await listBranches(clanId, owner.client);
    expect(list.find((b) => b.id === id)).toBeUndefined();
  });

  it("viewer can list but cannot insert", async () => {
    expect(await listBranches(clanId, viewer.client)).not.toBeNull();
    await expect(
      createBranch({ clan_id: clanId, name: "Viewer attempt" }, viewer.client),
    ).rejects.toThrow();
  });

  it("listPersons filters by branchId", async () => {
    const { id: bx } = await createBranch(
      { clan_id: clanId, name: "Filter Chi X" },
      owner.client,
    );
    await createPerson(
      { clan_id: clanId, full_name: "X1", gender: "M", branch_id: bx },
      owner.client,
    );
    await createPerson(
      { clan_id: clanId, full_name: "X2", gender: "F", branch_id: bx },
      owner.client,
    );
    await createPerson(
      { clan_id: clanId, full_name: "Other", gender: "M" },
      owner.client,
    );

    const filtered = await listPersons(
      clanId,
      { page: 1, pageSize: 50, branchId: bx },
      owner.client,
    );
    expect(filtered.total).toBe(2);
    expect(filtered.rows.every((p) => ["X1", "X2"].includes(p.full_name))).toBe(true);
  });

  it("viewer's update/delete are no-ops (RLS hides the row from write path)", async () => {
    const { id } = await createBranch(
      { clan_id: clanId, name: "Locked" },
      owner.client,
    );

    // PostgREST returns success with 0 affected rows when RLS filters them;
    // there is no error, but the underlying data must not change.
    await updateBranch(id, { name: "Tampered" }, viewer.client);
    await deleteBranch(id, viewer.client);

    const list = await listBranches(clanId, owner.client);
    const row = list.find((b) => b.id === id);
    expect(row?.name).toBe("Locked");
  });
});
