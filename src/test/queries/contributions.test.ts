import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import {
  approveContribution,
  countPendingContributions,
  listContributions,
  rejectContribution,
  submitContribution,
} from "@/lib/queries/contributions";
import { inviteMemberByEmail } from "@/lib/queries/members";
import { createPerson, getPerson } from "@/lib/queries/persons";

import { createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

describe("queries: contributions", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let clanId: string;
  let targetPersonId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "ContribOwner" });
    viewer = await createTestUser({ displayName: "ContribViewer" });
    stranger = await createTestUser({ displayName: "ContribStranger" });
    cleanup.push(owner.id, viewer.id, stranger.id);
    const r = await createClan(
      { name: "Contribution Clan" },
      owner.id,
      owner.client,
    );
    clanId = r.id;
    await inviteMemberByEmail(clanId, viewer.email, "viewer", owner.client);
    const p = await createPerson(
      {
        clan_id: clanId,
        full_name: "Cụ Nguyễn Văn A",
        gender: "M",
        is_living: false,
        birth_date: "1900-01-01",
        birth_date_precision: "year",
      },
      owner.client,
    );
    targetPersonId = p.id;
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("viewer submits an edit, admin approves, person row reflects the change", async () => {
    const submitted = await submitContribution(
      {
        clan_id: clanId,
        person_id: targetPersonId,
        contribution_type: "edit_person",
        proposed_data: {
          changes: { death_date: "1995-06-15", death_date_precision: "day" },
          original: { death_date: null },
        },
        submitter_relation: "cháu nội",
        submitter_note: "Tôi có giấy chứng tử",
      },
      viewer.id,
      viewer.client,
    );
    expect(submitted.status).toBe("pending");
    expect(submitted.submitter_user_id).toBe(viewer.id);

    // Admin sees it pending
    const pending = await listContributions(
      clanId,
      { status: "pending" },
      owner.client,
    );
    expect(pending.some((c) => c.id === submitted.id)).toBe(true);
    expect(await countPendingContributions(clanId, owner.client)).toBeGreaterThanOrEqual(1);

    // Approve
    await approveContribution(submitted.id, owner.client);

    const after = await getPerson(targetPersonId, owner.client);
    expect(after?.death_date).toBe("1995-06-15");

    const approved = (
      await listContributions(clanId, { status: "approved" }, owner.client)
    ).find((c) => c.id === submitted.id);
    expect(approved?.reviewer_user_id).toBe(owner.id);
  });

  it("viewer cannot impersonate another user via RLS", async () => {
    // submitter_user_id must equal auth.uid() — pinned by policy.
    const { error } = await viewer.client
      .from("contributions")
      .insert({
        clan_id: clanId,
        person_id: targetPersonId,
        contribution_type: "edit_person",
        proposed_data: { changes: { full_name: "Hacked" } },
        submitter_user_id: owner.id, // not their own → blocked
      });
    expect(error).not.toBeNull();
  });

  it("stranger (non-member) cannot list or submit", async () => {
    // INSERT requires is_clan_member, stranger is not in clan → RLS denies
    await expect(
      submitContribution(
        {
          clan_id: clanId,
          person_id: targetPersonId,
          contribution_type: "add_note",
          proposed_data: { note_addition: "Spam" },
        },
        stranger.id,
        stranger.client,
      ),
    ).rejects.toThrow();
    // SELECT: stranger sees nothing
    const rows = await listContributions(clanId, {}, stranger.client);
    expect(rows).toHaveLength(0);
  });

  it("viewer cannot approve their own contribution", async () => {
    const submitted = await submitContribution(
      {
        clan_id: clanId,
        person_id: targetPersonId,
        contribution_type: "add_note",
        proposed_data: { note_addition: "Cụ từng làm hương trưởng" },
        submitter_relation: "cháu nội",
      },
      viewer.id,
      viewer.client,
    );
    await expect(
      approveContribution(submitted.id, viewer.client),
    ).rejects.toThrow();
  });

  it("add_note appends to existing bio with a separator", async () => {
    // Seed an initial bio
    await owner.client
      .from("persons")
      .update({ bio: "Tiểu sử ban đầu." })
      .eq("id", targetPersonId);
    const sub = await submitContribution(
      {
        clan_id: clanId,
        person_id: targetPersonId,
        contribution_type: "add_note",
        proposed_data: { note_addition: "Bổ sung mới." },
        submitter_relation: "khách",
      },
      viewer.id,
      viewer.client,
    );
    await approveContribution(sub.id, owner.client);
    const after = await getPerson(targetPersonId, owner.client);
    expect(after?.bio).toMatch(/Tiểu sử ban đầu/);
    expect(after?.bio).toMatch(/Bổ sung mới/);
  });

  it("add_person creates a new person with the relation hint applied", async () => {
    const sub = await submitContribution(
      {
        clan_id: clanId,
        contribution_type: "add_person",
        proposed_data: {
          full_name: "Nguyễn Văn B",
          gender: "M",
          is_living: true,
          birth_date: "1960-01-01",
          birth_date_precision: "year",
          relation: { as: "child", of_person_id: targetPersonId },
        },
        submitter_relation: "cháu nội",
      },
      viewer.id,
      viewer.client,
    );
    await approveContribution(sub.id, owner.client);
    // The contribution's person_id should now point at the created row.
    const fresh = (
      await listContributions(clanId, { status: "approved" }, owner.client)
    ).find((c) => c.id === sub.id);
    expect(fresh?.person_id).not.toBeNull();
    if (!fresh?.person_id) return;
    const created = await getPerson(fresh.person_id, owner.client);
    expect(created?.full_name).toBe("Nguyễn Văn B");
    // getPerson() drops birth_family_id from the projection — query
    // the raw row to confirm the relation was wired.
    const { data: raw } = await owner.client
      .from("persons")
      .select("birth_family_id")
      .eq("id", fresh.person_id)
      .single();
    expect(raw?.birth_family_id).not.toBeNull();
  });

  it("reject_contribution flips status and records the note", async () => {
    const sub = await submitContribution(
      {
        clan_id: clanId,
        person_id: targetPersonId,
        contribution_type: "add_note",
        proposed_data: { note_addition: "Sai sự thật" },
        submitter_relation: "khách",
      },
      viewer.id,
      viewer.client,
    );
    await rejectContribution(sub.id, "rejected", "Không có nguồn", owner.client);
    const after = (
      await listContributions(clanId, { status: "rejected" }, owner.client)
    ).find((c) => c.id === sub.id);
    expect(after?.status).toBe("rejected");
    expect(after?.review_note).toBe("Không có nguồn");
  });

  it("approving an already-resolved contribution is rejected", async () => {
    const sub = await submitContribution(
      {
        clan_id: clanId,
        person_id: targetPersonId,
        contribution_type: "add_note",
        proposed_data: { note_addition: "x" },
        submitter_relation: "khách",
      },
      viewer.id,
      viewer.client,
    );
    await rejectContribution(sub.id, "rejected", null, owner.client);
    await expect(
      approveContribution(sub.id, owner.client),
    ).rejects.toThrow();
  });
});
