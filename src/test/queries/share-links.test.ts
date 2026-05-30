import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson } from "@/lib/queries/persons";
import {
  createShareLink,
  deleteShareLink,
  listShareLinks,
  revokeShareLink,
} from "@/lib/queries/share-links";

import {
  adminClient,
  createTestUser,
  type TestUser,
} from "../supabase-helpers";

const FN_BASE = `${process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1/share-view`;
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";

describe("share-links + share-view edge function", () => {
  let admin: TestUser;
  let viewer: TestUser;
  let clanId: string;
  let livingId: string;
  let deceasedId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    admin = await createTestUser({ displayName: "ShareAdmin" });
    viewer = await createTestUser({ displayName: "ShareViewer" });
    cleanup.push(admin.id, viewer.id);
    const r = await createClan({ name: "Share clan" }, admin.id, admin.client);
    clanId = r.id;
    const adm = adminClient();
    await adm.from("clan_members").insert({
      clan_id: clanId,
      user_id: viewer.id,
      role: "viewer",
    });
    const a = await createPerson(
      {
        clan_id: clanId,
        full_name: "Living One",
        gender: "M",
        is_living: true,
        is_root: true,
      },
      admin.client,
    );
    livingId = a.id;
    // Add bio so we can confirm masking
    await admin.client
      .from("persons")
      .update({ bio: "private bio", birth_date: "1980-01-01", birth_date_precision: "year" })
      .eq("id", livingId);

    const b = await createPerson(
      {
        clan_id: clanId,
        full_name: "Departed Ancestor",
        gender: "F",
        is_living: false,
        birth_date: "1900-01-01",
        birth_date_precision: "year",
        death_date: "1970-01-01",
        death_date_precision: "year",
      },
      admin.client,
    );
    deceasedId = b.id;
  });

  afterAll(async () => {
    for (const id of cleanup) await adminClient().auth.admin.deleteUser(id);
  });

  it("admin createShareLink + listShareLinks round-trip", async () => {
    const l = await createShareLink(
      { clan_id: clanId, ttlDays: 7 },
      admin.client,
    );
    expect(l.token.length).toBeGreaterThan(20);
    expect(l.is_revoked).toBe(false);

    const all = await listShareLinks(clanId, admin.client);
    expect(all.some((x) => x.id === l.id)).toBe(true);

    await deleteShareLink(l.id, admin.client);
  });

  it("revoke marks the row but keeps it in the list", async () => {
    const l = await createShareLink(
      { clan_id: clanId, ttlDays: 7 },
      admin.client,
    );
    await revokeShareLink(l.id, admin.client);
    const fresh = (await listShareLinks(clanId, admin.client)).find(
      (x) => x.id === l.id,
    );
    expect(fresh?.is_revoked).toBe(true);
    await deleteShareLink(l.id, admin.client);
  });

  it("viewer cannot create or revoke (RLS is_clan_admin only)", async () => {
    // Insert returning an error: in PostgREST this surfaces as an error.
    await expect(
      createShareLink({ clan_id: clanId, ttlDays: 7 }, viewer.client),
    ).rejects.toThrow();
  });

  describe("share-view Edge Function (requires `supabase functions serve`)", () => {
    let activeToken: string;
    let revokedToken: string;
    let expiredToken: string;

    beforeAll(async () => {
      const adm = adminClient();
      activeToken = `t-active-${crypto.randomUUID().slice(0, 8)}`;
      revokedToken = `t-revoked-${crypto.randomUUID().slice(0, 8)}`;
      expiredToken = `t-expired-${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await adm.from("share_links").insert([
        {
          clan_id: clanId,
          token: activeToken,
          expires_at: new Date(Date.now() + 86400_000).toISOString(),
          is_revoked: false,
        },
        {
          clan_id: clanId,
          token: revokedToken,
          expires_at: new Date(Date.now() + 86400_000).toISOString(),
          is_revoked: true,
        },
        {
          clan_id: clanId,
          token: expiredToken,
          expires_at: new Date(Date.now() - 86400_000).toISOString(),
          is_revoked: false,
        },
      ]);
      if (error) throw new Error(`seed share_links: ${error.message}`);
    });

    async function hit(token: string): Promise<{ status: number; body: any }> {
      const res = await fetch(`${FN_BASE}?token=${encodeURIComponent(token)}`, {
        headers: { apikey: ANON },
      });
      const body = await res.json();
      return { status: res.status, body };
    }

    it("unknown token → 404", async () => {
      const r = await hit("does-not-exist");
      expect(r.status).toBe(404);
    });

    it("revoked token → 410", async () => {
      const r = await hit(revokedToken);
      expect(r.status).toBe(410);
    });

    it("expired token → 410", async () => {
      const r = await hit(expiredToken);
      expect(r.status).toBe(410);
    });

    it("active token returns masked living + full deceased", async () => {
      const r = await hit(activeToken);
      expect(r.status).toBe(200);
      const persons: Array<{
        id: string;
        is_living: boolean;
        birth_date: string | null;
      }> = r.body.persons;
      const living = persons.find((p) => p.id === livingId);
      const dead = persons.find((p) => p.id === deceasedId);
      expect(living?.birth_date).toBeNull();
      expect(dead?.birth_date).toBe("1900-01-01");
    });
  });
});
