import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * RLS + RPC coverage for cross-clan in-law links (Section 28 of plan.md).
 *
 * Two test clans (A and B) wired up with admin/viewer/stranger users.
 * Each test creates an isolated person pair where needed so order
 * dependencies don't bite. Where the RPCs are the only path (e.g.
 * confirm_link_by_token), we exercise them through the user-scoped
 * client to prove the SECURITY DEFINER guards work end-to-end.
 */
describe("RLS: cross-clan in-law links", () => {
  let adminA: TestUser;
  let viewerA: TestUser;
  let adminB: TestUser;
  let viewerB: TestUser;
  let stranger: TestUser;
  let clanA: string;
  let clanB: string;

  // Persons in each clan — reused across the cheap tests, recreated
  // when a test needs a fresh pair.
  let personA: string;
  let personB: string;

  beforeAll(async () => {
    adminA = await createTestUser({ displayName: "Inlaws Admin A" });
    viewerA = await createTestUser({ displayName: "Inlaws Viewer A" });
    adminB = await createTestUser({ displayName: "Inlaws Admin B" });
    viewerB = await createTestUser({ displayName: "Inlaws Viewer B" });
    stranger = await createTestUser({ displayName: "Inlaws Stranger" });

    clanA = await createTestClan(adminA, { name: "Inlaws Clan A", maxUsers: 5 });
    clanB = await createTestClan(adminB, { name: "Inlaws Clan B", maxUsers: 5 });
    await addMember(clanA, viewerA, "viewer");
    await addMember(clanB, viewerB, "viewer");

    // Seed one person per clan. Use the service role so we control IDs
    // for the FK checks; the protect_person_link triggers only run on
    // person_links rows, not persons.
    //
    // is_living=false so peek tests aren't tripped up by the
    // hide_living mask — the hide_living test creates its own living
    // person to exercise that branch.
    const admin = adminClient();
    const ins = await admin
      .from("persons")
      .insert([
        { clan_id: clanA, full_name: "Person A", gender: "F", is_living: false },
        { clan_id: clanB, full_name: "Person B", gender: "F", is_living: false },
      ])
      .select("id, clan_id");
    if (ins.error || !ins.data) {
      throw new Error(`person seed failed: ${ins.error?.message}`);
    }
    personA = ins.data.find((p) => p.clan_id === clanA)!.id;
    personB = ins.data.find((p) => p.clan_id === clanB)!.id;
  });

  afterAll(async () => {
    await deleteUser(adminA.id);
    await deleteUser(viewerA.id);
    await deleteUser(adminB.id);
    await deleteUser(viewerB.id);
    await deleteUser(stranger.id);
  });

  // ── INSERT (propose) ────────────────────────────────────────────

  it("admin A can propose a pending link with a token", async () => {
    const token = `t-${Math.random()}`;
    const { data, error } = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending");
    // Cleanup so the partial-unique index doesn't trip later tests.
    await adminClient().from("person_links").delete().eq("id", data!.id);
  });

  it("viewer A CANNOT propose (must be clan admin)", async () => {
    const { error } = await viewerA.client.from("person_links").insert({
      clan_a_id: clanA,
      person_a_id: personA,
      invite_token: `t-${Math.random()}`,
      created_by: viewerA.id,
    });
    expect(error).not.toBeNull();
  });

  it("admin A cannot propose with a different user's created_by", async () => {
    const { error } = await adminA.client.from("person_links").insert({
      clan_a_id: clanA,
      person_a_id: personA,
      invite_token: `t-${Math.random()}`,
      created_by: adminB.id, // not me — policy pins to auth.uid()
    });
    expect(error).not.toBeNull();
  });

  // ── confirm_link_by_token ───────────────────────────────────────

  it("admin B can confirm a pending token; afterwards token is dead", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const linkId = ins.data!.id;

    const { data: confirmId, error: cErr } = await adminB.client.rpc(
      "confirm_link_by_token",
      { p_token: token, p_clan_b: clanB, p_person_b: personB },
    );
    expect(cErr).toBeNull();
    expect(confirmId).toBe(linkId);

    // Token should be cleared, status confirmed (read via service role
    // to bypass any RLS scoping).
    const row = await adminClient()
      .from("person_links")
      .select("status, invite_token, confirmed_by")
      .eq("id", linkId)
      .single();
    expect(row.data?.status).toBe("confirmed");
    expect(row.data?.invite_token).toBeNull();
    expect(row.data?.confirmed_by).toBe(adminB.id);

    // Reuse the same token → invalid.
    const { error: reuseErr } = await adminB.client.rpc(
      "confirm_link_by_token",
      { p_token: token, p_clan_b: clanB, p_person_b: personB },
    );
    expect(reuseErr).not.toBeNull();

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("admin A CANNOT confirm their own proposal (must be admin of clan B)", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();

    const { error } = await adminA.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanA, // same clan — RPC rejects
      p_person_b: personA,
    });
    expect(error).not.toBeNull();

    // Also try confirming as adminA into clanB — but adminA is not
    // admin of clanB, so is_clan_admin check rejects.
    const { error: err2 } = await adminA.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });
    expect(err2).not.toBeNull();

    await adminClient()
      .from("person_links")
      .delete()
      .eq("id", ins.data!.id);
  });

  it("viewer B CANNOT confirm even with valid token", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();

    const { error } = await viewerB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });
    expect(error).not.toBeNull();

    await adminClient()
      .from("person_links")
      .delete()
      .eq("id", ins.data!.id);
  });

  // ── get_link_peek ──────────────────────────────────────────────

  it("pending link: get_link_peek raises (no data hé)", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();

    const { error } = await adminA.client.rpc("get_link_peek", {
      p_link_id: ins.data!.id,
    });
    expect(error).not.toBeNull();

    await adminClient()
      .from("person_links")
      .delete()
      .eq("id", ins.data!.id);
  });

  it("confirmed link: member sees peer projection, NOT full persons row", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });

    // viewer A (member of A but NOT of B) reads peek → gets B side
    const { data: peek, error: peekErr } = await viewerA.client.rpc(
      "get_link_peek",
      { p_link_id: linkId },
    );
    expect(peekErr).toBeNull();
    expect(peek).toBeTruthy();
    const p = peek as unknown as { clan_id: string; person_id: string; full_name?: string };
    expect(p.clan_id).toBe(clanB);
    expect(p.person_id).toBe(personB);
    expect(p.full_name).toBe("Person B");

    // Same viewer trying to read persons of B directly → RLS blocks
    const { data: directRead } = await viewerA.client
      .from("persons")
      .select("id")
      .eq("id", personB);
    expect(directRead ?? []).toHaveLength(0);

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("stranger (member of neither clan) CANNOT peek", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });

    const { error } = await stranger.client.rpc("get_link_peek", {
      p_link_id: linkId,
    });
    expect(error).not.toBeNull();

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("hide_living masks living peer for non-members; reveals dead peer", async () => {
    // get_link_peek always returns info about the OTHER side relative
    // to the caller. So when viewerA (member of clanA) peeks, they
    // see clanB's person. We toggle that person's is_living state to
    // exercise both masked and unmasked branches.
    const admin = adminClient();
    const pbFresh = await admin
      .from("persons")
      .insert({
        clan_id: clanB,
        full_name: "Hide Test Peer",
        gender: "F",
        is_living: true,
      })
      .select("id")
      .single();
    const peerB = pbFresh.data!.id;

    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: peerB,
    });

    // Living + viewerA not a member of clanB + clanB.hide_living=true → masked.
    const { data: maskedPeek } = await viewerA.client.rpc("get_link_peek", {
      p_link_id: linkId,
    });
    const m = maskedPeek as unknown as { masked: boolean; full_name?: string };
    expect(m.masked).toBe(true);
    expect(m.full_name).toBeUndefined();

    // Flip the peer to deceased — same caller, no longer masked.
    await admin.from("persons").update({ is_living: false }).eq("id", peerB);
    const { data: unmaskedPeek } = await viewerA.client.rpc("get_link_peek", {
      p_link_id: linkId,
    });
    const u = unmaskedPeek as unknown as { masked: boolean; full_name?: string };
    expect(u.masked).toBe(false);
    expect(u.full_name).toBe("Hide Test Peer");

    await admin.from("person_links").delete().eq("id", linkId);
    await admin.from("persons").delete().eq("id", peerB);
  });

  // ── Revoke / soft-delete ────────────────────────────────────────

  it("revoke breaks the peek; both clans' persons rows survive", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });

    // Admin B revokes.
    const { error: revErr } = await adminB.client
      .from("person_links")
      .update({ status: "revoked" })
      .eq("id", linkId);
    expect(revErr).toBeNull();

    // Peek now raises.
    const { error: peekErr } = await viewerA.client.rpc("get_link_peek", {
      p_link_id: linkId,
    });
    expect(peekErr).not.toBeNull();

    // Both persons rows still readable by their respective members.
    const { data: pa } = await viewerA.client
      .from("persons")
      .select("id")
      .eq("id", personA)
      .maybeSingle();
    expect(pa?.id).toBe(personA);
    const { data: pb } = await viewerB.client
      .from("persons")
      .select("id")
      .eq("id", personB)
      .maybeSingle();
    expect(pb?.id).toBe(personB);

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("soft-deleted peer: peek raises (treated as gone)", async () => {
    const admin = adminClient();
    // Fresh person on clan B that we'll soft-delete.
    const tmpIns = await admin
      .from("persons")
      .insert({ clan_id: clanB, full_name: "Tmp Peer", gender: "F" })
      .select("id")
      .single();
    const tmpId = tmpIns.data!.id;

    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: tmpId,
    });

    // Soft-delete the peer
    await admin
      .from("persons")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tmpId);

    const { error: peekErr } = await viewerA.client.rpc("get_link_peek", {
      p_link_id: linkId,
    });
    expect(peekErr).not.toBeNull();

    await admin.from("person_links").delete().eq("id", linkId);
    await admin.from("persons").delete().eq("id", tmpId);
  });

  // ── Immutability ────────────────────────────────────────────────

  it("trigger blocks rolling status from confirmed back to pending", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });

    // .select() forces PostgREST into return=representation — without
    // it some trigger-raised errors round-trip as 204 No Content and
    // surface as a silent success client-side.
    const { error } = await adminA.client
      .from("person_links")
      .update({ status: "pending" })
      .eq("id", linkId)
      .select("status");
    expect(error).not.toBeNull();

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  // ── Anonymous resolve_link_token ───────────────────────────────

  // ── Audit trail ─────────────────────────────────────────────────

  it("propose + confirm + revoke each write one audit_log row under clan_a", async () => {
    const admin = adminClient();
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;
    await adminB.client.rpc("confirm_link_by_token", {
      p_token: token,
      p_clan_b: clanB,
      p_person_b: personB,
    });
    await adminA.client
      .from("person_links")
      .update({ status: "revoked" })
      .eq("id", linkId)
      .select("status");

    // Audit rows are scoped to clan_a — read via the proposer admin.
    const { data: rows, error } = await adminA.client
      .from("audit_log")
      .select("action, entity_type, entity_id, clan_id")
      .eq("entity_type", "person_link")
      .eq("entity_id", linkId)
      .order("changed_at", { ascending: true });
    expect(error).toBeNull();
    expect(rows).toHaveLength(3);
    expect(rows!.map((r) => r.action)).toEqual(["insert", "update", "update"]);
    expect(rows!.every((r) => r.clan_id === clanA)).toBe(true);

    // Clan B viewer does NOT see the audit rows (RLS is_clan_member on clan_id).
    const { data: bRows } = await viewerB.client
      .from("audit_log")
      .select("id")
      .eq("entity_id", linkId);
    expect(bRows ?? []).toHaveLength(0);

    await admin.from("person_links").delete().eq("id", linkId);
  });

  it("audit insert action carries the after-jsonb snapshot", async () => {
    const admin = adminClient();
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
        person_b_name_hint: "Snapshot test",
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;

    const { data: rows } = await adminA.client
      .from("audit_log")
      .select("action, before, after")
      .eq("entity_id", linkId);
    expect(rows).toHaveLength(1);
    const row = rows![0];
    expect(row.action).toBe("insert");
    expect(row.before).toBeNull();
    const after = row.after as Record<string, unknown>;
    expect(after.person_b_name_hint).toBe("Snapshot test");
    expect(after.status).toBe("pending");

    await admin.from("person_links").delete().eq("id", linkId);
  });

  // ── Direct (public-discovery) mode ──────────────────────────────

  it("admin A can propose directly with B side set (no token)", async () => {
    const { data, error } = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        clan_b_id: clanB,
        person_b_id: personB,
        created_by: adminA.id,
        note: "Direct mode test",
      })
      .select("id, status, invite_token, clan_b_id, person_b_id")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending");
    expect(data?.invite_token).toBeNull();
    expect(data?.clan_b_id).toBe(clanB);
    expect(data?.person_b_id).toBe(personB);
    await adminClient().from("person_links").delete().eq("id", data!.id);
  });

  it("admin B can accept a direct-mode pending via plain UPDATE", async () => {
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        clan_b_id: clanB,
        person_b_id: personB,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;

    // Trigger stamps confirmed_by + confirmed_at; admin B just flips
    // status. .select() forces return=representation.
    const { data: updated, error } = await adminB.client
      .from("person_links")
      .update({ status: "confirmed" })
      .eq("id", linkId)
      .select("status, confirmed_by, confirmed_at")
      .single();
    expect(error).toBeNull();
    expect(updated?.status).toBe("confirmed");
    expect(updated?.confirmed_by).toBe(adminB.id);
    expect(updated?.confirmed_at).toBeTruthy();

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("admin B can SELECT a direct-mode pending row (RLS), but viewer B cannot accept", async () => {
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        clan_b_id: clanB,
        person_b_id: personB,
        created_by: adminA.id,
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;

    // viewerB sees the row (SELECT policy lets either-side members
    // read), so the UI list query returns it.
    const { data: seen } = await viewerB.client
      .from("person_links")
      .select("id, status")
      .eq("id", linkId)
      .maybeSingle();
    expect(seen?.id).toBe(linkId);

    // But viewerB cannot UPDATE status (only admin can confirm) —
    // either RLS blocks the row (0 rows updated, error null) or the
    // trigger raises if it gets through. Use .select() to force
    // postgrest into return=representation; a viewer-blocked UPDATE
    // returns null data with a "no rows" outcome we can detect.
    const { data, error } = await viewerB.client
      .from("person_links")
      .update({ status: "confirmed" })
      .eq("id", linkId)
      .select("status");
    // Either error is set, or the array is empty (RLS hid the row).
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("get_inlaw_proposal_preview returns A side to admin B; stranger blocked", async () => {
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        clan_b_id: clanB,
        person_b_id: personB,
        created_by: adminA.id,
        person_b_name_hint: "Hint preview",
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;

    const { data: previewRaw, error: pErr } = await adminB.client.rpc(
      "get_inlaw_proposal_preview",
      { p_link_id: linkId },
    );
    expect(pErr).toBeNull();
    const preview = previewRaw as unknown as {
      clan_a_name: string;
      person_a_name: string;
      person_b_name_hint: string | null;
    };
    expect(preview.clan_a_name).toBe("Inlaws Clan A");
    expect(preview.person_a_name).toBe("Person A");
    expect(preview.person_b_name_hint).toBe("Hint preview");

    // Stranger (member of neither clan) is rejected.
    const { error: strErr } = await stranger.client.rpc(
      "get_inlaw_proposal_preview",
      { p_link_id: linkId },
    );
    expect(strErr).not.toBeNull();

    await adminClient().from("person_links").delete().eq("id", linkId);
  });

  it("anon can call resolve_link_token but only for active pending tokens", async () => {
    const token = `t-${Math.random()}`;
    const ins = await adminA.client
      .from("person_links")
      .insert({
        clan_a_id: clanA,
        person_a_id: personA,
        invite_token: token,
        created_by: adminA.id,
        person_b_name_hint: "Hint shows in preview",
      })
      .select("id")
      .single();
    const linkId = ins.data!.id;

    // anon client (no auth) — same client signed-out users hit.
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321",
      process.env.VITE_SUPABASE_ANON_KEY ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: preview, error } = await anon.rpc("resolve_link_token", {
      p_token: token,
    });
    expect(error).toBeNull();
    const p = preview as unknown as {
      clan_a_name: string;
      person_b_name_hint: string | null;
    };
    expect(p.clan_a_name).toBe("Inlaws Clan A");
    expect(p.person_b_name_hint).toBe("Hint shows in preview");

    // Bogus token rejects.
    const { error: bogusErr } = await anon.rpc("resolve_link_token", {
      p_token: "definitely-not-a-real-token",
    });
    expect(bogusErr).not.toBeNull();

    await adminClient().from("person_links").delete().eq("id", linkId);
  });
});
