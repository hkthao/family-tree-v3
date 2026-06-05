import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson } from "@/lib/queries/persons";
import {
  createShareLink,
  deleteShareLink,
  getOrCreatePersonShareLink,
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

  it("getOrCreatePersonShareLink reuses the same active token", async () => {
    const first = await getOrCreatePersonShareLink(
      clanId,
      deceasedId,
      admin.client,
    );
    expect(first.scope).toBe("single_person");
    expect(first.root_person_id).toBe(deceasedId);

    const second = await getOrCreatePersonShareLink(
      clanId,
      deceasedId,
      admin.client,
    );
    // Same row — so the same QR engraved on a tombstone keeps resolving.
    expect(second.id).toBe(first.id);
    expect(second.token).toBe(first.token);

    // After revoke, a fresh one is minted.
    await revokeShareLink(first.id, admin.client);
    const third = await getOrCreatePersonShareLink(
      clanId,
      deceasedId,
      admin.client,
    );
    expect(third.id).not.toBe(first.id);

    await deleteShareLink(first.id, admin.client);
    await deleteShareLink(third.id, admin.client);
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
      expect(r.body.scope).toBe("tree_view");
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

    it("scope=single_person returns focal + parents + spouse + children only", async () => {
      const adm = adminClient();

      // Build a focal with a father (deceased), a living spouse, and
      // one child — so we can confirm the edge function pulls each
      // relation in and masks the spouse.
      const father = await createPerson(
        {
          clan_id: clanId,
          full_name: "Focal Father",
          gender: "M",
          is_living: false,
          birth_date: "1890-01-01",
          birth_date_precision: "year",
        },
        admin.client,
      );
      const focal = await createPerson(
        {
          clan_id: clanId,
          full_name: "Focal Person",
          gender: "M",
          is_living: false,
          birth_date: "1920-01-01",
          birth_date_precision: "year",
          death_date: "1990-01-01",
          death_date_precision: "year",
        },
        admin.client,
      );
      // Decorate focal with extra fields that should ride along in the
      // single_person response.
      await adm
        .from("persons")
        .update({ bio: "Tiểu sử", birth_place: "Hà Nội", courtesy_name: "Tự X" })
        .eq("id", focal.id);
      // Birth family — father is husband.
      const { data: birthFam } = await adm
        .from("families")
        .insert({ clan_id: clanId, husband_id: father.id })
        .select("id")
        .single();
      await adm
        .from("persons")
        .update({ birth_family_id: birthFam!.id })
        .eq("id", focal.id);
      // Marriage.
      const spouse = await createPerson(
        {
          clan_id: clanId,
          full_name: "Focal Spouse",
          gender: "F",
          is_living: true,
        },
        admin.client,
      );
      const { data: marriage } = await adm
        .from("families")
        .insert({
          clan_id: clanId,
          husband_id: focal.id,
          wife_id: spouse.id,
        })
        .select("id")
        .single();
      // Child.
      const child = await createPerson(
        {
          clan_id: clanId,
          full_name: "Focal Child",
          gender: "M",
          is_living: true,
        },
        admin.client,
      );
      await adm
        .from("persons")
        .update({ birth_family_id: marriage!.id })
        .eq("id", child.id);
      // Sibling — should NOT appear in single_person view.
      const sibling = await createPerson(
        {
          clan_id: clanId,
          full_name: "Focal Sibling",
          gender: "F",
          is_living: false,
          birth_date: "1925-01-01",
          birth_date_precision: "year",
        },
        admin.client,
      );
      await adm
        .from("persons")
        .update({ birth_family_id: birthFam!.id })
        .eq("id", sibling.id);

      // Mint a person-scope share link.
      const personToken = `t-person-${crypto.randomUUID().slice(0, 8)}`;
      await adm.from("share_links").insert({
        clan_id: clanId,
        token: personToken,
        root_person_id: focal.id,
        scope: "single_person",
        expires_at: new Date(Date.now() + 86400_000).toISOString(),
      });

      const r = await hit(personToken);
      expect(r.status).toBe(200);
      expect(r.body.scope).toBe("single_person");
      const ids = new Set<string>(r.body.persons.map((p: any) => p.id));
      expect(ids.has(focal.id)).toBe(true);
      expect(ids.has(father.id)).toBe(true);
      expect(ids.has(spouse.id)).toBe(true);
      expect(ids.has(child.id)).toBe(true);
      // Sibling shares the birth_family with focal but should NOT be
      // pulled in — single_person traverses parents + marriages, not
      // siblings.
      expect(ids.has(sibling.id)).toBe(false);

      // Focal carries the extra detail fields.
      const focalRow = r.body.persons.find((p: any) => p.id === focal.id);
      expect(focalRow.bio).toBe("Tiểu sử");
      expect(focalRow.birth_place).toBe("Hà Nội");
      expect(focalRow.courtesy_name).toBe("Tự X");

      // Living spouse is still masked.
      const spouseRow = r.body.persons.find((p: any) => p.id === spouse.id);
      expect(spouseRow.is_living).toBe(true);
      expect(spouseRow.birth_date).toBeNull();
    });
  });
});
