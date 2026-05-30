import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson, listPersons } from "@/lib/queries/persons";
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
