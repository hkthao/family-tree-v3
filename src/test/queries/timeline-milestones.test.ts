import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson } from "@/lib/queries/persons";
import {
  createMilestone,
  listTimelineRows,
  updateMilestone,
} from "@/lib/queries/timeline";

import { addMember, createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

// Kho mốc dùng chung: poster dòng họ (on_clan) + dòng thời gian của từng người (person_id).
describe("queries: timeline milestones (kho dùng chung)", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let clanId: string;
  let otherClanId: string;
  let personId: string;
  let otherPersonId: string;
  const cleanup: string[] = [];
  const client = (u: TestUser) => u.client as never;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "TlOwner" });
    viewer = await createTestUser({ displayName: "TlViewer" });
    stranger = await createTestUser({ displayName: "TlStranger" });
    cleanup.push(owner.id, viewer.id, stranger.id);
    clanId = (await createClan({ name: "Timeline Clan" }, owner.id, owner.client)).id;
    otherClanId = (await createClan({ name: "Other Clan" }, stranger.id, stranger.client)).id;
    await addMember(clanId, viewer, "viewer");
    personId = (await createPerson({ clan_id: clanId, full_name: "Người Thử", gender: "M" }, owner.client)).id;
    otherPersonId = (await createPerson({ clan_id: otherClanId, full_name: "Người Khác", gender: "M" }, stranger.client)).id;
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("editor thêm mốc dòng họ và mốc của người; hai phạm vi tách đúng", async () => {
    await createMilestone(clanId, { year: 1975, title: "Mốc dòng họ", body: null, icon_key: null }, client(owner));
    await createMilestone(
      clanId,
      { year: 1950, title: "Sinh", body: null, icon_key: null, person_id: personId, on_clan: false, era: "Canh Dần" },
      client(owner),
    );
    await createMilestone(
      clanId,
      { year: 1980, title: "Mốc người đưa lên dòng họ", body: null, icon_key: null, person_id: personId, on_clan: true },
      client(owner),
    );

    const clanRows = await listTimelineRows(clanId, {}, client(owner));
    expect(clanRows.map((r) => r.title)).toEqual(["Mốc dòng họ", "Mốc người đưa lên dòng họ"]); // không có mốc on_clan=false

    const personRows = await listTimelineRows(clanId, { personId }, client(owner));
    expect(personRows.map((r) => r.title)).toEqual(["Sinh", "Mốc người đưa lên dòng họ"]);
    expect(personRows[0].era).toBe("Canh Dần");
    expect(personRows[0].on_clan).toBe(false);
  });

  it("thành viên chỉ xem đọc được, không ghi được", async () => {
    const rows = await listTimelineRows(clanId, {}, client(viewer));
    expect(rows.length).toBeGreaterThan(0);
    await expect(
      createMilestone(clanId, { year: 2000, title: "Lén thêm", body: null, icon_key: null }, client(viewer)),
    ).rejects.toThrow();
    await expect(updateMilestone(rows[0].id, { title: "Sửa lén" }, client(viewer))).resolves.toBeUndefined();
    const after = await listTimelineRows(clanId, {}, client(owner));
    expect(after.some((r) => r.title === "Sửa lén")).toBe(false); // update bị RLS lọc, không ghi
  });

  it("người ngoài dòng họ riêng tư không đọc được", async () => {
    const rows = await listTimelineRows(clanId, {}, client(stranger));
    expect(rows).toEqual([]);
  });

  it("không gắn được người của dòng họ khác vào mốc", async () => {
    await expect(
      createMilestone(
        clanId,
        { year: 1990, title: "Sai dòng họ", body: null, icon_key: null, person_id: otherPersonId },
        client(owner),
      ),
    ).rejects.toThrow();
  });

  it("ràng buộc dữ liệu: năm 0 / tiêu đề trống / thứ tự ngoài 0–999 bị từ chối", async () => {
    await expect(createMilestone(clanId, { year: 10000, title: "x", body: null, icon_key: null }, client(owner))).rejects.toThrow();
    await expect(createMilestone(clanId, { year: 1990, title: "   ", body: null, icon_key: null }, client(owner))).rejects.toThrow();
    await expect(
      createMilestone(clanId, { year: 1990, title: "x", sort_order: 1000, body: null, icon_key: null }, client(owner)),
    ).rejects.toThrow();
  });
});
