import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RESOURCE_OPS } from "../../../mcp-server/src/resources";

import { addMember, adminClient, createTestClan, createTestUser, deleteUser, type TestUser } from "../supabase-helpers";

/**
 * Phân quyền của bộ tool CRUD (Bảng tin, Phòng ký ức, Ảnh ghép, Di sản, Mộ phần, Quỹ họ, Bảng vàng) chạy với phiên
 * đăng nhập THẬT trên Supabase local — đúng cách máy chủ MCP chạy (client mang JWT của chủ token, RLS áp dụng).
 * Hai lớp cần giữ: RLS (vai trò trong dòng họ) và các kiểm tra trong code (khoá theo dòng họ đang chọn, id cha/người/sự kiện
 * phải thuộc cùng dòng họ — RLS không tự kiểm những chuyện này).
 */
describe("MCP resources: phân quyền với phiên thật", () => {
  const users: TestUser[] = [];
  let admin: TestUser, editor: TestUser, viewer: TestUser, outsider: TestUser;
  let A = "";
  let B = "";
  let personA = "";
  let personB = "";
  const svc = adminClient();

  const ctx = (u: TestUser, clan = A) => ({ db: u.client as never, clanId: clan, userId: u.id, fresh: async () => u.client as never });
  const run = async (u: TestUser, tool: string, args: Record<string, unknown>, clan = A): Promise<{ ok: boolean; text: string }> => {
    try {
      return { ok: true, text: await RESOURCE_OPS[tool](ctx(u, clan), args) };
    } catch (e) {
      return { ok: false, text: (e as Error).message };
    }
  };
  const idOf = (t: string) => t.match(/id ([0-9a-f-]{36})/)?.[1] ?? "";

  beforeAll(async () => {
    [admin, editor, viewer, outsider] = await Promise.all([1, 2, 3, 4].map((i) => createTestUser({ displayName: `MCP perm ${i}`, maxClans: i === 1 ? 2 : undefined })));
    users.push(admin, editor, viewer, outsider);
    A = await createTestClan(admin);
    B = await createTestClan(admin); // admin là quản trị của CẢ HAI họ
    await addMember(A, editor, "editor");
    await addMember(A, viewer, "viewer");
    personA = (await svc.from("persons").insert({ clan_id: A, full_name: "Người A", gender: "M" }).select("id").single()).data!.id;
    personB = (await svc.from("persons").insert({ clan_id: B, full_name: "Người B", gender: "M" }).select("id").single()).data!.id;
  });
  afterAll(async () => {
    for (const u of users) await deleteUser(u.id);
  });

  it("người xem chỉ đọc được; mọi lệnh tạo bị RLS chặn", async () => {
    for (const [tool, args] of [
      ["create_honor_entry", { honoree_name: "X", category: "other" }],
      ["create_fund_transaction", { direction: "in", amount: 1, fund: "Q" }],
      ["create_heritage_item", { category: "place", title: "T" }],
      ["create_resting_place", { kind: "grave" }],
      ["create_memory_room", { name: "R" }],
      ["create_mosaic", { title: "M" }],
    ] as const) {
      expect((await run(viewer, tool, { ...args })).ok, tool).toBe(false);
    }
    expect((await run(viewer, "list_honor_entries", {})).ok).toBe(true);
    expect((await run(viewer, "fund_summary", {})).ok).toBe(true);
  });

  it("người xem chỉ gửi được bài vào hàng chờ duyệt, không đăng thẳng", async () => {
    const r = await run(viewer, "create_post", { type: "news", body: "bài của người xem" });
    if (r.ok) expect(r.text).toMatch(/chờ/);
  });

  it("người ngoài dòng họ: không ghi được, không thấy dữ liệu", async () => {
    for (const [tool, args] of [
      ["create_honor_entry", { honoree_name: "X", category: "other" }],
      ["create_fund_transaction", { direction: "in", amount: 1, fund: "Q" }],
      ["create_mosaic", { title: "M" }],
      ["create_post", { type: "news", body: "x" }],
    ] as const) {
      expect((await run(outsider, tool, { ...args })).ok, tool).toBe(false);
    }
    for (const tool of ["list_honor_entries", "list_fund_transactions", "list_heritage_items", "list_resting_places", "list_memory_rooms", "list_mosaics", "list_posts"]) {
      const r = await run(outsider, tool, {});
      expect(!r.ok || /Không có/.test(r.text), tool).toBe(true);
    }
  });

  it("biên tập viên làm CRUD đầy đủ; xoá phải confirm và là xoá mềm", async () => {
    let r = await run(editor, "create_honor_entry", { honoree_name: "Công đức", category: "donation_money", amount: 500000, person_id: personA });
    expect(r.ok, r.text).toBe(true);
    const id = idOf(r.text);
    expect((await run(editor, "update_honor_entry", { honor_entry_id: id, amount: 750000, note: null })).ok).toBe(true);
    expect((await run(editor, "list_honor_entries", { id })).text).toContain("750000");
    r = await run(editor, "delete_honor_entry", { honor_entry_id: id });
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/confirm/);
    expect((await run(editor, "delete_honor_entry", { honor_entry_id: id, confirm: true })).ok).toBe(true);
    expect((await svc.from("honor_entries").select("deleted_at").eq("id", id).single()).data?.deleted_at).not.toBeNull();
    expect((await run(editor, "list_honor_entries", {})).text).not.toContain("750000");
  });

  it("quỹ họ: kiểm số liệu, tổng thu/chi đúng", async () => {
    expect((await run(editor, "create_fund_transaction", { direction: "in", amount: 1_000_000, fund: "Quỹ test" })).ok).toBe(true);
    expect((await run(editor, "create_fund_transaction", { direction: "out", amount: 250_000, fund: "Quỹ test" })).ok).toBe(true);
    expect((await run(editor, "create_fund_transaction", { direction: "in", amount: -5, fund: "Q" })).ok).toBe(false);
    expect((await run(editor, "create_fund_transaction", { direction: "sideways", amount: 5, fund: "Q" })).ok).toBe(false);
    const s = JSON.parse((await run(viewer, "fund_summary", {})).text);
    expect(s.tong_thu).toBe(1_000_000);
    expect(s.tong_chi).toBe(250_000);
    expect(s.so_du).toBe(750_000);
  });

  it("di sản / mộ phần: chỉ gắn người cùng dòng họ", async () => {
    const h = idOf((await run(editor, "create_heritage_item", { category: "place", title: "Nhà thờ họ" })).text);
    expect((await run(editor, "add_heritage_person", { heritage_item_id: h, person_id: personA })).ok).toBe(true);
    const bad = await run(editor, "add_heritage_person", { heritage_item_id: h, person_id: personB });
    expect(bad.ok).toBe(false);
    expect(bad.text).toMatch(/không thuộc dòng họ/);
    const rp = idOf((await run(editor, "create_resting_place", { kind: "grave", name: "Mộ test" })).text);
    expect((await run(editor, "add_resting_place_occupant", { resting_place_id: rp, person_id: personA })).ok).toBe(true);
    expect((await run(editor, "add_resting_place_occupant", { resting_place_id: rp, person_id: personB })).ok).toBe(false);
    expect((await run(editor, "list_resting_place_occupants", { resting_place_id: rp })).text).toContain(personA);
    expect((await run(editor, "remove_resting_place_occupant", { resting_place_id: rp, person_id: personA })).ok).toBe(false); // thiếu confirm
    expect((await run(editor, "remove_resting_place_occupant", { resting_place_id: rp, person_id: personA, confirm: true })).ok).toBe(true);
  });

  it("dòng thời gian: biên tập thêm/thay được, thay cần confirm, người xem & khác họ bị chặn", async () => {
    const tl = (u: TestUser, a: Record<string, unknown>, clan = A) => run(u, "set_person_timeline", { person_id: personA, ...a }, clan);
    expect((await tl(editor, { entries: [{ year: 1990, era: "Canh Ngọ", body: "Sinh ra" }, { year: 2010, body: "Lập gia đình" }] })).ok).toBe(true);
    expect((await tl(editor, { entries: [{ year: 2000, body: "Tốt nghiệp" }] })).ok).toBe(true);
    let rows = JSON.parse((await run(viewer, "get_person_timeline", { person_id: personA })).text);
    expect(rows.map((r: { year: number }) => r.year)).toEqual([1990, 2000, 2010]);
    expect((await tl(editor, { entries: [{ year: 1990, body: "x", extra: 1 }] })).ok).toBe(false);
    expect((await tl(editor, { entries: [{ year: 1990, body: "  " }] })).ok).toBe(false);
    expect((await tl(editor, { entries: [{ year: 1.5, body: "x" }] })).ok).toBe(false);
    const noConfirm = await tl(editor, { mode: "replace", entries: [{ year: 1995, body: "Mới" }] });
    expect(noConfirm.ok).toBe(false);
    expect(noConfirm.text).toMatch(/confirm/);
    expect((await tl(editor, { mode: "replace", entries: [{ year: 1995, body: "Mới" }], confirm: true })).ok).toBe(true);
    rows = JSON.parse((await run(editor, "get_person_timeline", { person_id: personA })).text);
    expect(rows).toHaveLength(1);
    expect((await tl(viewer, { entries: [{ year: 1999, body: "người xem" }] })).ok).toBe(false);
    expect((await tl(outsider, { entries: [{ year: 1999, body: "người ngoài" }] })).ok).toBe(false);
    expect((await run(editor, "set_person_timeline", { person_id: personB, entries: [{ year: 1999, body: "khác họ" }] })).ok).toBe(false);
    expect((await run(admin, "set_person_timeline", { person_id: personA, entries: [{ year: 1999, body: "chéo" }] }, B)).ok).toBe(false);
    expect((await svc.from("person_timeline").select("id").eq("person_id", personA)).data).toHaveLength(1);
  });

  it("phòng ký ức: chỉ link https, đúng một nguồn ảnh, người phải cùng họ", async () => {
    const room = idOf((await run(editor, "create_memory_room", { name: "Phòng test" })).text);
    expect((await run(editor, "add_memory_room_item", { memory_room_id: room, kind: "photo", image_url: "http://x.example/a.jpg" })).ok).toBe(false);
    expect((await run(editor, "add_memory_room_item", { memory_room_id: room, kind: "photo", image_url: "https://example.com/a.jpg", person_id: personA })).ok).toBe(false);
    expect((await run(editor, "add_memory_room_item", { memory_room_id: room, kind: "photo", person_id: personB })).ok).toBe(false);
    expect((await run(editor, "add_memory_room_item", { memory_room_id: room, kind: "photo", image_url: "https://example.com/a.jpg", caption: "Ảnh" })).ok).toBe(true);
  });

  it("ảnh ghép: giới hạn số liệu; chỉ một bức hiện ở Tổng quan", async () => {
    const m1 = idOf((await run(editor, "create_mosaic", { title: "Ghép 1", cols: 4, slots: 16 })).text);
    expect((await run(editor, "create_mosaic", { title: "Ghép x", cols: 99 })).ok).toBe(false);
    const m2 = idOf((await run(editor, "create_mosaic", { title: "Ghép 2" })).text);
    await run(editor, "set_mosaic_dashboard", { mosaic_id: m1, on: true });
    await run(editor, "set_mosaic_dashboard", { mosaic_id: m2, on: true });
    const on = (await svc.from("clan_mosaics").select("id").eq("clan_id", A).eq("show_on_dashboard", true)).data!.map((x) => x.id);
    expect(on).toEqual([m2]);
  });

  it("chống ghi trường ngoài danh sách", async () => {
    const room = idOf((await run(editor, "create_memory_room", { name: "P2" })).text);
    for (const bad of [{ clan_id: B }, { deleted_at: "2026-01-01" }, { created_by: personA }, { is_public: true }]) {
      const r = await run(editor, "update_memory_room", { memory_room_id: room, name: "x", ...bad });
      expect(r.ok, Object.keys(bad)[0]).toBe(false);
      expect(r.text).toMatch(/không được phép/);
    }
    expect((await run(editor, "list_honor_entries", { clan_id: B })).ok).toBe(false);
  });

  it("bảng tin: quản trị đăng thẳng, người khác chờ duyệt, chỉ quản trị kiểm duyệt", async () => {
    const pe = idOf((await run(editor, "create_post", { type: "news", title: "Tin", body: "Nội dung" })).text);
    expect((await svc.from("clan_posts").select("status").eq("id", pe).single()).data?.status).toBe("pending");
    const pa = await run(admin, "create_post", { type: "notice", body: "Thông báo" });
    expect(pa.text).toMatch(/Đã đăng/);
    expect((await run(editor, "moderate_post", { post_id: pe, action: "publish" })).ok).toBe(false);
    expect((await run(admin, "moderate_post", { post_id: pe, action: "publish" })).ok).toBe(true);
    expect((await run(admin, "moderate_post", { post_id: pe, action: "explode" })).ok).toBe(false);
    expect((await run(admin, "delete_post", { post_id: pe })).text).toMatch(/confirm/);
    expect((await run(admin, "delete_post", { post_id: pe, confirm: true })).ok).toBe(true);
    expect((await run(admin, "list_posts", {})).text).not.toContain(pe);
    expect((await run(editor, "create_post", { type: "event", body: "x", event_id: "00000000-0000-4000-8000-000000000000" })).ok).toBe(false);
  });

  it("CHÉO DÒNG HỌ: quản trị ở cả hai họ, kết nối đang chọn họ A, không đụng được dữ liệu họ B", async () => {
    const hb = (await svc.from("heritage_items").insert({ clan_id: B, category: "place", title: "Di sản họ B" }).select("id").single()).data!.id;
    const pb = (await svc.from("clan_posts").insert({ clan_id: B, author_id: admin.id, type: "news", body: "bài họ B", status: "pending" }).select("id").single()).data!.id;
    const rb = (await svc.from("memory_rooms").insert({ clan_id: B, name: "Phòng họ B" }).select("id").single()).data!.id;

    expect((await run(admin, "update_heritage_item", { heritage_item_id: hb, title: "đã bị sửa" })).text).toMatch(/Không ghi được/);
    expect((await svc.from("heritage_items").select("title").eq("id", hb).single()).data?.title).toBe("Di sản họ B");
    expect((await run(admin, "add_heritage_person", { heritage_item_id: hb, person_id: personA })).ok).toBe(false);
    expect((await run(admin, "moderate_post", { post_id: pb, action: "publish" })).ok).toBe(false);
    expect((await svc.from("clan_posts").select("status").eq("id", pb).single()).data?.status).toBe("pending");
    expect((await run(admin, "add_memory_room_item", { memory_room_id: rb, kind: "photo", image_url: "https://example.com/y.jpg" })).ok).toBe(false);
    expect((await run(admin, "create_post", { type: "news", body: "x", person_id: personB })).ok).toBe(false);
    expect((await run(admin, "list_heritage_items", {})).text).not.toContain(hb);
    await run(admin, "delete_heritage_item", { heritage_item_id: hb, confirm: true });
    expect((await svc.from("heritage_items").select("deleted_at").eq("id", hb).single()).data?.deleted_at).toBeNull();
    // cùng tool, đúng họ B → làm được (chứng tỏ chặn ở trên là do khoá theo dòng họ, không phải lỗi khác)
    expect((await run(admin, "update_heritage_item", { heritage_item_id: hb, title: "Sửa đúng họ" }, B)).ok).toBe(true);
  });

  it("bản đồ: thành viên đọc được số liệu, người ngoài thì không", async () => {
    expect((await run(viewer, "map_stats", {})).ok).toBe(true);
    expect((await run(outsider, "map_stats", {})).ok).toBe(false);
  });
});
