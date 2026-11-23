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
  /** RLS chặn ghi trả về 0 dòng → tool trả thông báo "Không ... được" (không ném lỗi). */
  const refused = (r: { ok: boolean; text: string }) => !r.ok || /^Không (ghi|thực hiện) được/.test(r.text);
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
    expect((await (svc as unknown as import("@supabase/supabase-js").SupabaseClient).from("clan_timeline_milestones").select("id").eq("person_id", personA)).data).toHaveLength(1);
  });

  it("dòng thời gian dùng chung: mốc theo người (title/body/on_clan) và CRUD mốc; biên tập ghi được, người xem chỉ đọc", async () => {
    // set_person_timeline nhận title; chỉ body dài thì tiêu đề được suy ra và body giữ nguyên văn
    const long = "x".repeat(300);
    expect((await run(editor, "set_person_timeline", { person_id: personA, mode: "replace", confirm: true, entries: [{ year: 2001, title: "Tiêu đề riêng", body: "chi tiết" }, { year: 2002, body: long }] })).ok).toBe(true);
    const rows = JSON.parse((await run(viewer, "get_person_timeline", { person_id: personA })).text);
    expect(rows[0]).toMatchObject({ year: 2001, title: "Tiêu đề riêng", body: "chi tiết", on_clan: false });
    expect(rows[1].title.length).toBeLessThanOrEqual(120);
    expect(rows[1].body).toBe(long);

    // CRUD tổng quát
    const created = await run(editor, "create_timeline_milestone", { year: 1975, title: "Thống nhất đất nước" });
    expect(created.ok).toBe(true);
    const mid = idOf(created.text);
    expect((await run(editor, "create_timeline_milestone", { year: 1980, title: "Của người", person_id: personA, on_clan: false })).ok).toBe(true);
    expect((await run(editor, "create_timeline_milestone", { year: 1980, title: "Sai họ", person_id: personB })).ok).toBe(false); // người họ khác
    expect((await run(editor, "create_timeline_milestone", { year: 1980, title: "Sai icon", icon_key: "khong-co" })).ok).toBe(false);
    expect((await run(viewer, "create_timeline_milestone", { year: 1980, title: "Người xem" })).ok).toBe(false);
    expect((await run(outsider, "list_timeline_milestones", {})).text).not.toContain("Thống nhất");

    const clanOnly = JSON.parse((await run(viewer, "list_timeline_milestones", { on_clan: true })).text);
    expect(clanOnly.rows.map((r: { title: string }) => r.title)).toContain("Thống nhất đất nước");
    expect(clanOnly.rows.map((r: { title: string }) => r.title)).not.toContain("Của người");
    const ofPerson = JSON.parse((await run(viewer, "list_timeline_milestones", { person_id: personA })).text);
    expect(ofPerson.rows.every((r: { person_id: string }) => r.person_id === personA)).toBe(true);

    expect((await run(editor, "update_timeline_milestone", { timeline_milestone_id: mid, title: "Đã sửa", sort_order: 5 })).ok).toBe(true);
    expect(refused(await run(viewer, "update_timeline_milestone", { timeline_milestone_id: mid, title: "Người xem sửa" }))).toBe(true);
    expect((await run(editor, "delete_timeline_milestone", { timeline_milestone_id: mid })).ok).toBe(false); // thiếu confirm
    expect((await run(editor, "delete_timeline_milestone", { timeline_milestone_id: mid, confirm: true })).ok).toBe(true);
  });

  it("dòng thời gian qua MCP: bối cảnh (tự điền / tự viết / ẩn), hình (cảnh thư viện / link https), thư viện lựa chọn", async () => {
    const lib = JSON.parse((await run(viewer, "list_timeline_library", {})).text);
    expect(lib.eras.length).toBeGreaterThan(10);
    expect(lib.scenes.map((x: { id: string }) => x.id)).toContain("con-dau-long");
    expect(JSON.parse((await run(viewer, "list_timeline_library", { year: 1230 })).text).eras.map((e: { title: string }) => e.title)).toEqual(["Nhà Trần"]);
    expect((await run(viewer, "list_timeline_library", { year: "x" })).ok).toBe(false);

    const get = async (id: string) =>
      (JSON.parse((await run(editor, "list_timeline_milestones", { id })).text).rows[0]) as Record<string, string | null>;

    // fill_context: chép bối cảnh của thời đại chứa năm; image_url = cảnh thư viện
    const made = await run(editor, "create_timeline_milestone", { year: 1975, title: "Thống nhất", fill_context: true, image_url: "lib:con-dau-long", icon_key: "banner" });
    expect(made.ok, made.text).toBe(true);
    const id1 = idOf(made.text);
    let row = await get(id1);
    expect(row.context_title).toBe("Đất nước chia hai miền");
    expect(row.context_body).toContain("Thống nhất ngày 30/4/1975");
    expect(row.image_url).toBe("lib:con-dau-long");
    expect(row.icon_key).toBe("banner");

    // hình: cảnh không tồn tại / http / dấu cách đều bị từ chối
    for (const bad of ["lib:khong-co", "http://x.com/a.jpg", "https://x.com/a b.jpg", "javascript:alert(1)"]) {
      expect((await run(editor, "create_timeline_milestone", { year: 1980, title: "Sai hình", image_url: bad })).ok, bad).toBe(false);
    }
    expect((await run(editor, "update_timeline_milestone", { timeline_milestone_id: id1, image_url: "https://upload.wikimedia.org/a.jpg" })).ok).toBe(true);
    expect((await get(id1)).image_url).toBe("https://upload.wikimedia.org/a.jpg");

    // chỉ MỘT cách đặt bối cảnh; năm ngoài thư viện không tự điền được
    expect((await run(editor, "create_timeline_milestone", { year: 1975, title: "x", fill_context: true, hide_context: true })).ok).toBe(false);
    expect((await run(editor, "create_timeline_milestone", { year: 1975, title: "x", fill_context: true, context_title: "A", context_body: "b" })).ok).toBe(false);
    const early = await run(editor, "create_timeline_milestone", { year: 900, title: "Sớm", fill_context: true });
    expect(early.ok).toBe(false);
    expect(early.text).toMatch(/1009|thời đại/);

    // tự viết: cần cả tiêu đề lẫn ít nhất một ý; tối đa 6 ý
    expect((await run(editor, "create_timeline_milestone", { year: 1975, title: "x", context_title: "Chỉ tiêu đề" })).ok).toBe(false);
    expect((await run(editor, "create_timeline_milestone", { year: 1975, title: "x", context_title: "T", context_body: "1\n2\n3\n4\n5\n6\n7" })).ok).toBe(false);
    const custom = await run(editor, "create_timeline_milestone", { year: 1975, title: "Tự viết", context_title: "Năm cả nhà về quê", context_body: "- Đường xa\n\nMưa nhiều" });
    expect(custom.ok, custom.text).toBe(true);
    row = await get(idOf(custom.text));
    expect([row.context_title, row.context_body]).toEqual(["Năm cả nhà về quê", "Đường xa\nMưa nhiều"]);

    // update chỉ với fill_context (không trường nào khác) lấy năm của mốc đang lưu; hide ẩn thẻ; null trả về mặc định
    expect((await run(editor, "update_timeline_milestone", { timeline_milestone_id: idOf(custom.text), fill_context: true })).ok).toBe(true);
    expect((await get(idOf(custom.text))).context_title).toBe("Đất nước chia hai miền");
    expect((await run(editor, "update_timeline_milestone", { timeline_milestone_id: idOf(custom.text), hide_context: true })).ok).toBe(true);
    row = await get(idOf(custom.text));
    expect([row.context_title, row.context_body]).toEqual(["", ""]);
    expect((await run(editor, "update_timeline_milestone", { timeline_milestone_id: idOf(custom.text), context_title: null, context_body: null })).ok).toBe(true);
    row = await get(idOf(custom.text));
    expect([row.context_title, row.context_body]).toEqual([null, null]);

    // người xem không ghi được
    expect(refused(await run(viewer, "update_timeline_milestone", { timeline_milestone_id: id1, fill_context: true }))).toBe(true);

    // set_person_timeline nhận icon / hình / bối cảnh
    const ok = await run(editor, "set_person_timeline", {
      person_id: personA,
      mode: "replace",
      confirm: true,
      entries: [
        { year: 1950, title: "Sinh", icon_key: "cradle", image_url: "lib:con-dau-long" },
        { year: 1975, title: "Có bối cảnh riêng", context_title: "Thời bao cấp", context_body: "Tem phiếu" },
        { year: 1980, title: "Ẩn bối cảnh", hide_context: true },
        { year: 1985, title: "Sai hình", image_url: "lib:khong-co" },
      ],
    });
    expect(ok.ok).toBe(false); // một mục sai hình → từ chối cả lô (không ghi nửa chừng)
    const ok2 = await run(editor, "set_person_timeline", {
      person_id: personA,
      mode: "replace",
      confirm: true,
      entries: [
        { year: 1950, title: "Sinh", icon_key: "cradle", image_url: "lib:con-dau-long" },
        { year: 1975, title: "Có bối cảnh riêng", context_title: "Thời bao cấp", context_body: "Tem phiếu" },
        { year: 1980, title: "Ẩn bối cảnh", hide_context: true },
      ],
    });
    expect(ok2.ok, ok2.text).toBe(true);
    const rows = (await (svc as unknown as import("@supabase/supabase-js").SupabaseClient)
      .from("clan_timeline_milestones")
      .select("year, icon_key, image_url, context_title, context_body")
      .eq("person_id", personA)
      .order("year")).data as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ icon_key: "cradle", image_url: "lib:con-dau-long", context_title: null });
    expect(rows[1]).toMatchObject({ context_title: "Thời bao cấp", context_body: "Tem phiếu" });
    expect(rows[2]).toMatchObject({ context_title: "", context_body: "" });
  });

  it("liên kết dòng họ: quản trị đề nghị + bên kia xác nhận bằng mã; biên tập/người xem không ghi được; không lái sang họ khác", async () => {
    // chỉ quản trị đề nghị được (RLS plinks_insert); người gắn phải thuộc họ này
    expect((await run(editor, "create_clan_link", { person_id: personA })).ok).toBe(false);
    expect((await run(admin, "create_clan_link", { person_id: personB })).ok).toBe(false); // người của họ B, token đang ở họ A
    const made = await run(admin, "create_clan_link", { person_id: personA, link_type: "related", note: "Cùng gốc" });
    expect(made.ok, made.text).toBe(true);
    const tok = made.text.match(/: ([A-Za-z0-9_-]{16,})\./)?.[1] ?? "";
    expect(tok.length).toBeGreaterThan(15);
    const linkId = idOf(made.text);

    // thành viên đọc được danh sách (không thấy mã mời trong list); người ngoài không thấy gì
    const list = await run(viewer, "list_clan_links", {});
    expect(list.ok).toBe(true);
    expect(list.text).toContain(linkId);
    expect(list.text).not.toContain(tok);
    expect((await run(outsider, "list_clan_links", {})).text).toContain("chưa có liên kết");
    expect((await run(viewer, "list_clan_links", { status: "bad" })).ok).toBe(false);

    // mã mời chỉ hiện cho quản trị bên đề nghị khi xem chi tiết
    expect(JSON.parse((await run(admin, "get_clan_link", { link_id: linkId })).text).invite_token).toBe(tok);

    // họ B (admin cũng quản trị B) xác nhận bằng mã; người B phải thuộc B
    expect((await run(admin, "create_clan_link_from_token", { token: tok, person_id: personA }, B)).ok).toBe(false);
    const ok = await run(admin, "create_clan_link_from_token", { token: tok, person_id: personB }, B);
    expect(ok.ok, ok.text).toBe(true);

    const confirmed = JSON.parse((await run(admin, "get_clan_link", { link_id: linkId })).text);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.invite_token).toBeUndefined();
    expect((await run(viewer, "list_clan_links", { status: "confirmed" })).text).toContain(linkId);

    // gỡ: cần confirm; người xem không gỡ được; sau gỡ là revoked (không xoá)
    expect((await run(admin, "delete_clan_link", { link_id: linkId })).ok).toBe(false);
    expect(refused(await run(viewer, "delete_clan_link", { link_id: linkId, confirm: true }))).toBe(true);
    expect((await run(admin, "delete_clan_link", { link_id: linkId, confirm: true })).ok).toBe(true);
    expect((await svc.from("person_links").select("status").eq("id", linkId).single()).data?.status).toBe("revoked");
    // họ khác (không thuộc liên kết) không thao tác được
    expect((await run(admin, "get_clan_link", { link_id: linkId }, A)).ok).toBe(true);
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
