import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addMember,
  adminClient,
  anonClient,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Mộ phần của dòng họ công khai: người ngoài (khách hoặc tài khoản không thuộc họ) không đọc thẳng bảng, nên không thấy toạ độ / địa chỉ / ghi chú
 * (docs/bao-mat-trang-cong-khai.md, rủi ro 2). Thành viên vẫn đọc đủ; người ngoài xem qua trang dòng họ (share-view, service role).
 */
describe("RLS: resting_places của dòng họ công khai", () => {
  let owner: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let clanId: string;
  let graveId: string;
  let personId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "GraveOwner" });
    member = await createTestUser({ displayName: "GraveMember" });
    stranger = await createTestUser({ displayName: "GraveStranger" });
    clanId = await createTestClan(owner, {
      name: "Họ Mộ Công Khai",
      visibility: "public",
    });
    await addMember(clanId, member, "viewer");
    const admin = adminClient();
    await admin
      .from("clans")
      .update({ share_sections: ["graves"], public_show_tree: true })
      .eq("id", clanId);
    const { data: g, error } = await admin
      .from("resting_places")
      .insert({
        clan_id: clanId,
        kind: "grave",
        name: "Thọ Lăng",
        location_name: "hương Tinh Cương",
        address: "Số 1 đường bí mật",
        location_detail: "sau gốc đa",
        latitude: 20.1234,
        longitude: 106.5678,
        notes: "Ghi chú nội bộ",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    graveId = g!.id;
    const { data: p } = await admin
      .from("persons")
      .insert({
        clan_id: clanId,
        full_name: "Cụ Thọ",
        gender: "M",
        is_living: false,
      })
      .select("id")
      .single();
    personId = p!.id;
    await admin
      .from("resting_place_occupants")
      .insert({
        clan_id: clanId,
        resting_place_id: graveId,
        person_id: personId,
        note: "Ghi chú riêng của người",
      });
  });

  afterAll(async () => {
    for (const u of [owner, member, stranger]) await deleteUser(u.id);
  });

  it("khách (khoá anon) KHÔNG đọc được bảng mộ phần — không toạ độ / địa chỉ / ghi chú, kể cả select *", async () => {
    for (const col of [
      "id",
      "name",
      "latitude",
      "longitude",
      "address",
      "location_detail",
      "notes",
      "*",
    ]) {
      const { data, error } = await anonClient()
        .from("resting_places")
        .select(col)
        .eq("id", graveId);
      expect(error !== null || (data ?? []).length === 0, col).toBe(true);
    }
  });

  it("khách không đọc được người an nghỉ / ghi chú riêng của họ", async () => {
    for (const col of ["person_id", "note"]) {
      const { data, error } = await anonClient()
        .from("resting_place_occupants")
        .select(col)
        .eq("resting_place_id", graveId);
      expect(error !== null || (data ?? []).length === 0, col).toBe(true);
    }
  });

  it("người đăng nhập NGOÀI dòng họ không đọc thẳng bảng mộ phần / người an nghỉ / ảnh — kể cả khi họ công khai và bật mục Mộ phần", async () => {
    const g = await stranger.client
      .from("resting_places")
      .select("id, latitude, longitude, address")
      .eq("id", graveId);
    expect(g.data ?? []).toHaveLength(0);
    const o = await stranger.client
      .from("resting_place_occupants")
      .select("note")
      .eq("resting_place_id", graveId);
    expect(o.data ?? []).toHaveLength(0);
    const p = await stranger.client
      .from("resting_place_photos")
      .select("path")
      .eq("resting_place_id", graveId);
    expect(p.data ?? []).toHaveLength(0);
  });

  it("thành viên dòng họ vẫn đọc đủ (kể cả toạ độ, địa chỉ, ghi chú)", async () => {
    const { data, error } = await member.client
      .from("resting_places")
      .select("latitude, longitude, address, location_detail, notes")
      .eq("id", graveId)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      address: "Số 1 đường bí mật",
      notes: "Ghi chú nội bộ",
    });
  });
});
