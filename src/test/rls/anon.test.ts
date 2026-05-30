import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

describe("RLS: anon (unauthenticated)", () => {
  let owner: TestUser;
  let clanId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "Owner" });
    clanId = await createTestClan(owner, { visibility: "public" });
    await owner.client.from("persons").insert({
      clan_id: clanId,
      full_name: "Public root",
      gender: "M",
      is_root: true,
      is_living: false,
    });
  });

  afterAll(async () => {
    await deleteUser(owner.id);
  });

  it("anon cannot SELECT from persons", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("persons").select("id");
    // Either RLS returns empty OR PostgREST returns an error.
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon cannot SELECT from clans (even public)", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("clans").select("id");
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon cannot SELECT from clan_members", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("clan_members").select("id");
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon cannot INSERT into any data table", async () => {
    const anon = anonClient();
    const { error } = await anon.from("persons").insert({
      clan_id: clanId,
      full_name: "Anon should not insert",
      gender: "M",
    });
    expect(error).not.toBeNull();
  });
});
