import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson, listPersons } from "@/lib/queries/persons";

import {
  adminClient,
  anonClient,
  createTestUser,
  type TestUser,
} from "../supabase-helpers";

describe("persons_public_safe (hide living from non-members of public clans)", () => {
  let owner: TestUser;
  let outsider: TestUser;
  let publicClanId: string;
  let privateClanId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "PublicOwner", maxClans: 2 });
    outsider = await createTestUser({ displayName: "Outsider" });
    cleanup.push(owner.id, outsider.id);

    const pub = await createClan(
      { name: "Public clan", visibility: "public" },
      owner.id,
      owner.client,
    );
    publicClanId = pub.id;
    const priv = await createClan(
      { name: "Private clan", visibility: "private" },
      owner.id,
      owner.client,
    );
    privateClanId = priv.id;

    // Persons: 1 living + 1 deceased in each clan, plus sensitive fields.
    for (const cid of [publicClanId, privateClanId]) {
      await createPerson(
        {
          clan_id: cid,
          full_name: "Living Person",
          gender: "M",
          is_living: true,
          birth_date: "1990-01-01",
          birth_date_precision: "year",
        },
        owner.client,
      );
      // Set sensitive bio/birth_place on the living one
      await owner.client
        .from("persons")
        .update({ bio: "private bio", birth_place: "secret town" })
        .eq("clan_id", cid)
        .eq("full_name", "Living Person");

      await createPerson(
        {
          clan_id: cid,
          full_name: "Departed Soul",
          gender: "F",
          is_living: false,
          birth_date: "1900-01-01",
          birth_date_precision: "year",
          death_date: "1970-06-15",
          death_date_precision: "day",
        },
        owner.client,
      );
      await owner.client
        .from("persons")
        .update({ bio: "ancestor bio", birth_place: "old village" })
        .eq("clan_id", cid)
        .eq("full_name", "Departed Soul");
    }
  });

  afterAll(async () => {
    for (const id of cleanup) {
      try {
        await adminClient().auth.admin.deleteUser(id);
      } catch {
        /* ignore */
      }
    }
  });

  it("non-member of PUBLIC clan reads via view, sees masked living data", async () => {
    const { data, error } = await outsider.client
      .from("persons_public_safe")
      .select("full_name, is_living, bio, birth_place, birth_date")
      .eq("clan_id", publicClanId)
      .order("full_name");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const living = data!.find((r) => r.is_living === true);
    expect(living?.bio).toBeNull();
    expect(living?.birth_place).toBeNull();
    expect(living?.birth_date).toBeNull();

    const dead = data!.find((r) => r.is_living === false);
    expect(dead?.bio).toBe("ancestor bio");
    expect(dead?.birth_place).toBe("old village");
    expect(dead?.birth_date).toBe("1900-01-01");
  });

  it("non-member of PRIVATE clan gets nothing via view", async () => {
    const { data, error } = await outsider.client
      .from("persons_public_safe")
      .select("id")
      .eq("clan_id", privateClanId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("non-member of PRIVATE clan also gets nothing via persons table (RLS)", async () => {
    const { data } = await outsider.client
      .from("persons")
      .select("id")
      .eq("clan_id", privateClanId);
    expect(data).toEqual([]);
  });

  it("member sees raw data on persons (unmasked living)", async () => {
    const { data } = await owner.client
      .from("persons")
      .select("full_name, bio")
      .eq("clan_id", publicClanId)
      .eq("full_name", "Living Person");
    expect(data?.[0].bio).toBe("private bio");
  });

  it("listPersons(source='persons_public_safe') drives the public path", async () => {
    const r = await listPersons(
      publicClanId,
      { page: 1, pageSize: 10, source: "persons_public_safe" },
      outsider.client,
    );
    expect(r.total).toBe(2);
    const living = r.rows.find((p) => p.is_living);
    expect(living?.birth_date).toBeNull();
  });

  it("anon cannot SELECT the view (grant revoked)", async () => {
    const a = anonClient();
    const { data, error } = await a
      .from("persons_public_safe")
      .select("id")
      .eq("clan_id", publicClanId);
    // Either an error or empty — both meet the requirement that anon can
    // not retrieve data. PostgREST surfaces this as a permission error.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("non-member listPersons search/filter still works through the view", async () => {
    const r = await listPersons(
      publicClanId,
      {
        page: 1,
        pageSize: 10,
        search: "departed",
        source: "persons_public_safe",
      },
      outsider.client,
    );
    expect(r.total).toBe(1);
    expect(r.rows[0].full_name).toBe("Departed Soul");
  });
});
