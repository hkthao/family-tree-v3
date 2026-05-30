import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import {
  createPerson,
  deletePerson,
  getPerson,
  listPersons,
  updatePerson,
} from "@/lib/queries/persons";
import { unaccent } from "@/lib/unaccent";

import { createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

describe("queries: persons", () => {
  let owner: TestUser;
  let clanId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Owner" });
    cleanup.push(owner.id);
    const r = await createClan({ name: "Pagination Test" }, owner.id, owner.client);
    clanId = r.id;

    // Seed a known set of persons with varied diacritics for search testing
    const seeds: Array<{ name: string; gender: "M" | "F"; isRoot?: boolean }> = [
      { name: "Nguyễn Văn An", gender: "M", isRoot: true },
      { name: "Nguyễn Thị Bích", gender: "F" },
      { name: "Trần Hữu Cường", gender: "M" },
      { name: "Lê Đức Dũng", gender: "M" },
      { name: "Phạm Thị Hà", gender: "F" },
    ];
    for (const s of seeds) {
      await createPerson(
        { clan_id: clanId, full_name: s.name, gender: s.gender, is_root: s.isRoot },
        owner.client,
      );
    }
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("listPersons returns total + paginated rows", async () => {
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 3 },
      owner.client,
    );
    expect(r.total).toBe(5);
    expect(r.rows).toHaveLength(3);
    expect(r.page).toBe(1);
  });

  it("listPersons honors pageSize and page indexing", async () => {
    const page1 = await listPersons(
      clanId,
      { page: 1, pageSize: 2 },
      owner.client,
    );
    const page2 = await listPersons(
      clanId,
      { page: 2, pageSize: 2 },
      owner.client,
    );
    expect(page1.rows).toHaveLength(2);
    expect(page2.rows).toHaveLength(2);
    // Different rows
    const ids1 = page1.rows.map((p) => p.id);
    const ids2 = page2.rows.map((p) => p.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("listPersons searches without diacritics (unaccent on both sides)", async () => {
    // Search "nguyen" should match "Nguyễn …"
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 50, search: "nguyen" },
      owner.client,
    );
    expect(r.total).toBe(2);
    expect(r.rows.every((p) => p.full_name.startsWith("Nguyễn"))).toBe(true);
  });

  it("listPersons search 'duc' matches 'Đức' (đ→d normalization)", async () => {
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 50, search: "duc" },
      owner.client,
    );
    expect(r.total).toBe(1);
    expect(r.rows[0].full_name).toBe("Lê Đức Dũng");
  });

  it("listPersons sort=generation puts the root first", async () => {
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 10, sort: "generation" },
      owner.client,
    );
    // The is_root person should be first (generation = 1)
    expect(r.rows[0].is_root).toBe(true);
    expect(r.rows[0].generation).toBe(1);
  });

  it("getPerson returns the row; updatePerson then reflects changes", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Tạm Tên", gender: "M" },
      owner.client,
    );

    const before = await getPerson(id, owner.client);
    expect(before?.full_name).toBe("Tạm Tên");

    await updatePerson(
      id,
      { full_name: "Đổi Tên", bio: "Tiểu sử mới" },
      owner.client,
    );

    const after = await getPerson(id, owner.client);
    expect(after?.full_name).toBe("Đổi Tên");
    expect(after?.bio).toBe("Tiểu sử mới");
  });

  it("deletePerson soft-deletes (row no longer visible via getPerson / listPersons)", async () => {
    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Sẽ Xoá", gender: "F" },
      owner.client,
    );

    // Sanity
    expect((await getPerson(id, owner.client))?.id).toBe(id);

    await deletePerson(id, owner.client);

    // getPerson filters by deleted_at IS NULL → null
    expect(await getPerson(id, owner.client)).toBeNull();

    // listPersons filters out soft-deleted
    const listed = await listPersons(
      clanId,
      { page: 1, pageSize: 100 },
      owner.client,
    );
    expect(listed.rows.find((p) => p.id === id)).toBeUndefined();
  });

  it("viewer cannot updatePerson (RLS blocks)", async () => {
    const viewer = await createTestUser({ displayName: "Viewer" });
    cleanup.push(viewer.id);

    // Add viewer to the existing clan (need owner to do this)
    await owner.client.from("clan_members").insert({
      clan_id: clanId,
      user_id: viewer.id,
      role: "viewer",
    });

    const { id } = await createPerson(
      { clan_id: clanId, full_name: "Bị Sửa", gender: "M" },
      owner.client,
    );

    // viewer SELECT works (returns row); UPDATE silently no-ops via RLS USING
    // Actually our policy uses USING + WITH CHECK = can_edit_clan; viewer
    // matches USING (false), so update affects 0 rows but doesn't error.
    await updatePerson(id, { full_name: "Hacked" }, viewer.client);

    const stillOriginal = await getPerson(id, owner.client);
    expect(stillOriginal?.full_name).toBe("Bị Sửa");
  });

  it("non-member cannot listPersons (RLS empty result)", async () => {
    const outsider = await createTestUser({ displayName: "Outsider" });
    cleanup.push(outsider.id);
    const r = await listPersons(
      clanId,
      { page: 1, pageSize: 50 },
      outsider.client,
    );
    expect(r.total).toBe(0);
    expect(r.rows).toEqual([]);
  });
});

describe("unaccent helper", () => {
  it("strips Vietnamese diacritics + lowercases", () => {
    expect(unaccent("Nguyễn Văn A")).toBe("nguyen van a");
    expect(unaccent("Trần Hữu Cường")).toBe("tran huu cuong");
    expect(unaccent("Lê Đức Dũng")).toBe("le duc dung");
    expect(unaccent("Phạm Thị Hà")).toBe("pham thi ha");
  });

  it("handles uppercase Đ", () => {
    expect(unaccent("ĐẶNG VĂN")).toBe("dang van");
  });

  it("trims whitespace", () => {
    expect(unaccent("  Nguyễn  ")).toBe("nguyen");
  });
});
