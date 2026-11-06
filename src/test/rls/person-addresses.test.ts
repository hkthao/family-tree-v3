import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Địa chỉ thành viên (docs/plan-thong-ke-ban-do.md): CHỈ thành viên dòng họ xem được; không lọt ra
 * người ngoài / khách / dòng họ công khai. `clan_map_stats` chỉ trả số đếm và tự chặn người ngoài.
 */
describe("RLS: person_addresses + clan_map_stats", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let clanId: string;
  let personId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "AddrOwner" });
    viewer = await createTestUser({ displayName: "AddrViewer" });
    outsider = await createTestUser({ displayName: "AddrOutsider" });
    // Dòng họ CÔNG KHAI: người ngoài đọc được cây, nhưng KHÔNG được đọc địa chỉ.
    clanId = await createTestClan(owner, { visibility: "public" });
    await addMember(clanId, viewer, "viewer");
    const { data, error } = await owner.client
      .from("persons")
      .insert({ clan_id: clanId, full_name: "Người có địa chỉ", gender: "M", is_root: true, is_living: true })
      .select("id")
      .single();
    if (error || !data) throw new Error(`insert person failed: ${error?.message}`);
    personId = data.id;
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(viewer.id);
    await deleteUser(outsider.id);
  });

  it("editor/admin CAN save an address; clan_id is forced from the person", async () => {
    const { error } = await owner.client.from("person_addresses").upsert(
      {
        person_id: personId,
        // giá trị sai cố ý — trigger phải ghi đè bằng clan của người đó
        clan_id: "00000000-0000-0000-0000-000000000000",
        province_code: "01",
        ward_code: "00004",
        street_detail: "số 1",
        country: "VN",
      },
      { onConflict: "person_id" },
    );
    expect(error).toBeNull();
    const { data } = await owner.client
      .from("person_addresses")
      .select("clan_id, province_code")
      .eq("person_id", personId)
      .single();
    expect(data?.clan_id).toBe(clanId);
    expect(data?.province_code).toBe("01");
  });

  it("a plain viewer member CAN read but CANNOT write addresses", async () => {
    const read = await viewer.client.from("person_addresses").select("person_id").eq("person_id", personId);
    expect(read.data?.length).toBe(1);

    const write = await viewer.client
      .from("person_addresses")
      .update({ province_code: "79" })
      .eq("person_id", personId)
      .select("person_id");
    expect(write.data ?? []).toEqual([]);
  });

  it("outsider (even on a public clan) sees NO addresses", async () => {
    const { data } = await outsider.client.from("person_addresses").select("person_id");
    expect(data ?? []).toEqual([]);
  });

  it("anon sees NO addresses", async () => {
    const { data } = await anonClient().from("person_addresses").select("person_id");
    expect(data ?? []).toEqual([]);
  });

  it("clan_map_stats: member gets counts only; outsider and anon are rejected", async () => {
    const ok = await viewer.client.rpc("clan_map_stats", { p_clan: clanId, p_include_deceased: true });
    expect(ok.error).toBeNull();
    const stats = ok.data as unknown as { people: Record<string, number>; total: { people: number } };
    expect(stats.people["01"]).toBe(1);
    expect(stats.total.people).toBe(1);
    // chỉ số đếm — không có tên / địa chỉ chi tiết
    expect(JSON.stringify(stats)).not.toContain("Người có địa chỉ");
    expect(JSON.stringify(stats)).not.toContain("số 1");

    const out = await outsider.client.rpc("clan_map_stats", { p_clan: clanId, p_include_deceased: true });
    expect(out.error).not.toBeNull();
    const anon = await anonClient().rpc("clan_map_stats", { p_clan: clanId, p_include_deceased: true });
    expect(anon.error).not.toBeNull();
  });

  it("an empty address row can be removed by an editor", async () => {
    const del = await owner.client.from("person_addresses").delete().eq("person_id", personId);
    expect(del.error).toBeNull();
    const { data } = await owner.client.from("person_addresses").select("person_id").eq("person_id", personId);
    expect(data ?? []).toEqual([]);
  });
});
