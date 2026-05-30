import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { createClan } from "@/lib/queries/clans";
import { bulkImportPersons } from "@/lib/queries/import";
import type { ImportPayload } from "@/lib/importPersons";
import { listPersons } from "@/lib/queries/persons";

import {
  adminClient,
  createTestUser,
  type TestUser,
} from "../supabase-helpers";

describe("queries: bulk_import_persons RPC", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let clanId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Importer" });
    viewer = await createTestUser({ displayName: "Visitor" });
    cleanup.push(owner.id, viewer.id);
    const r = await createClan({ name: "Import target" }, owner.id, owner.client);
    clanId = r.id;
    const adm = adminClient();
    await adm.from("clan_members").insert({
      clan_id: clanId,
      user_id: viewer.id,
      role: "viewer",
    });
  });

  afterAll(async () => {
    for (const id of cleanup) await adminClient().auth.admin.deleteUser(id);
  });

  function buildPayload(): ImportPayload {
    const dad = randomUUID();
    const mom = randomUUID();
    const fam = randomUUID();
    const branch = randomUUID();
    return {
      branches: [{ id: branch, name: "Chi import" }],
      families: [{ id: fam, husband_id: dad, wife_id: mom }],
      persons: [
        {
          id: dad,
          full_name: "Bố",
          gender: "M",
          is_living: false,
          is_root: true,
          birth_date: "1900-01-01",
          birth_date_precision: "year",
          death_date: null,
          death_date_precision: null,
          branch_id: branch,
          birth_family_id: null,
          bio: null,
        },
        {
          id: mom,
          full_name: "Mẹ",
          gender: "F",
          is_living: false,
          is_root: false,
          birth_date: "1905-01-01",
          birth_date_precision: "year",
          death_date: null,
          death_date_precision: null,
          branch_id: branch,
          birth_family_id: null,
          bio: null,
        },
        {
          id: randomUUID(),
          full_name: "Con",
          gender: "M",
          is_living: true,
          is_root: false,
          birth_date: "1930-01-01",
          birth_date_precision: "year",
          death_date: null,
          death_date_precision: null,
          branch_id: branch,
          birth_family_id: fam,
          bio: "Ghi chú",
        },
      ],
    };
  }

  it("inserts persons, families, branches in one transaction", async () => {
    const result = await bulkImportPersons(clanId, buildPayload(), owner.client);
    expect(result.imported_persons).toBe(3);
    expect(result.imported_families).toBe(1);
    expect(result.imported_branches).toBe(1);

    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 100 },
      owner.client,
    );
    expect(r.total).toBe(3);
    expect(r.rows.find((p) => p.full_name === "Con")?.generation).toBe(2);
  });

  it("rejects a viewer (RLS via can_edit_clan)", async () => {
    await expect(
      bulkImportPersons(clanId, buildPayload(), viewer.client),
    ).rejects.toThrow(/Not allowed/i);
  });

  it("rejects when import would exceed max_persons", async () => {
    const adm = adminClient();
    const newOwner = await createTestUser({ displayName: "Tight" });
    cleanup.push(newOwner.id);
    const { id: cid } = await createClan(
      { name: "Tight clan" },
      newOwner.id,
      newOwner.client,
    );
    // Lower the cap as platform admin
    await adm.from("clans").update({ max_persons: 2 }).eq("id", cid);

    const payload: ImportPayload = {
      branches: [],
      families: [],
      persons: [
        { id: randomUUID(), full_name: "A", gender: "M", is_living: true, is_root: false, birth_date: null, birth_date_precision: null, death_date: null, death_date_precision: null, branch_id: null, birth_family_id: null, bio: null },
        { id: randomUUID(), full_name: "B", gender: "F", is_living: true, is_root: false, birth_date: null, birth_date_precision: null, death_date: null, death_date_precision: null, branch_id: null, birth_family_id: null, bio: null },
        { id: randomUUID(), full_name: "C", gender: "M", is_living: true, is_root: false, birth_date: null, birth_date_precision: null, death_date: null, death_date_precision: null, branch_id: null, birth_family_id: null, bio: null },
      ],
    };

    await expect(
      bulkImportPersons(cid, payload, newOwner.client),
    ).rejects.toThrow(/exceed max_persons/);

    // Nothing was inserted (single transaction)
    const r = await listPersons(cid, { page: 1, pageSize: 10 }, newOwner.client);
    expect(r.total).toBe(0);
  });
});
