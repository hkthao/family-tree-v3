import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClan } from "@/lib/queries/clans";
import { createPerson } from "@/lib/queries/persons";
import { getPersonTimeline, replacePersonTimeline } from "@/lib/queries/person-timeline";

import { addMember, createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

describe("queries: person-timeline", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let clanId: string;
  let personId: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "TimelineOwner" });
    viewer = await createTestUser({ displayName: "TimelineViewer" });
    cleanup.push(owner.id, viewer.id);
    clanId = (await createClan({ name: "Timeline Clan" }, owner.id, owner.client)).id;
    await addMember(clanId, viewer, "viewer");
    personId = (
      await createPerson({ clan_id: clanId, full_name: "Người Thử", gender: "M" }, owner.client)
    ).id;
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("chưa có mốc → rỗng", async () => {
    expect(await getPersonTimeline(personId, owner.client)).toEqual([]);
  });

  it("thay toàn bộ: lưu, đọc theo năm, rồi thay bản khác", async () => {
    await replacePersonTimeline(
      personId,
      clanId,
      [
        { year: 1230, era: "Canh Dần", body: "Soạn thông chế" },
        { year: 1226, era: null, body: "Lên ngôi" },
      ],
      owner.client,
    );
    let rows = await getPersonTimeline(personId, owner.client);
    expect(rows.map((r) => r.year)).toEqual([1226, 1230]);
    expect(rows[1]).toMatchObject({ era: "Canh Dần", body: "Soạn thông chế" });

    await replacePersonTimeline(personId, clanId, [{ year: 1240, era: " ", body: " Sinh con " }], owner.client);
    rows = await getPersonTimeline(personId, owner.client);
    expect(rows).toEqual([{ year: 1240, era: null, body: "Sinh con" }]);

    await replacePersonTimeline(personId, clanId, [], owner.client);
    expect(await getPersonTimeline(personId, owner.client)).toEqual([]);
  });

  it("người chỉ xem đọc được nhưng không ghi được", async () => {
    await replacePersonTimeline(personId, clanId, [{ year: 1250, era: null, body: "Mốc" }], owner.client);
    expect(await getPersonTimeline(personId, viewer.client)).toHaveLength(1);
    await expect(
      replacePersonTimeline(personId, clanId, [{ year: 1251, era: null, body: "Lén" }], viewer.client),
    ).rejects.toThrow();
    expect((await getPersonTimeline(personId, owner.client)).map((r) => r.year)).toEqual([1250]);
  });
});
