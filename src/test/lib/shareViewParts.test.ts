import { describe, expect, it } from "vitest";

import { handlePart, loadHeritageItem, parsePaging, type PartCtx } from "../../../supabase/functions/share-view/parts";

/**
 * share-view?part=… (docs/plan-trang-dong-ho.md, mục 3.2): mỗi phần chỉ phục vụ khi khoá share_sections bật,
 * không trả toạ độ / người còn sống, phân trang có trần. Client Supabase giả ghi lại chuỗi truy vấn.
 */

interface Call {
  table: string;
  select?: string;
  eq: [string, unknown][];
  filters: [string, string, unknown][];
  range?: [number, number];
}

function fakeSb(tables: Record<string, { data?: unknown; count?: number; single?: unknown }>) {
  const calls: Call[] = [];
  const sb = {
    from(table: string) {
      const call: Call = { table, eq: [], filters: [] };
      calls.push(call);
      const r = tables[table] ?? {};
      const b: Record<string, unknown> = {
        select(cols: string) {
          call.select = cols;
          return b;
        },
        eq(k: string, v: unknown) {
          call.eq.push([k, v]);
          return b;
        },
        is(k: string, v: unknown) {
          call.filters.push(["is", k, v]);
          return b;
        },
        not(k: string, op: string, v: unknown) {
          call.filters.push(["not", `${k} ${op}`, v]);
          return b;
        },
        lt(k: string, v: unknown) {
          call.filters.push(["lt", k, v]);
          return b;
        },
        gt(k: string, v: unknown) {
          call.filters.push(["gt", k, v]);
          return b;
        },
        order: () => b,
        limit: () => b,
        range(a: number, z: number) {
          call.range = [a, z];
          return b;
        },
        maybeSingle: () => Promise.resolve({ data: r.single ?? null, error: null }),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ data: r.data ?? [], count: r.count, error: null }).then(res),
      };
      return b;
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
  };
  return { sb, calls };
}

const ctx = (sb: unknown, sections: string[], over: Partial<PartCtx> = {}): PartCtx => ({
  sb,
  clanId: "clan-1",
  hidePhotos: false,
  sections,
  sign: async () => new Map(),
  ...over,
});

const ID = "11111111-1111-4111-8111-111111111111";
const q = (s: string) => new URLSearchParams(s);

describe("parsePaging", () => {
  it("mặc định, kẹp trần per và page, bỏ giá trị rác", () => {
    expect(parsePaging(q(""), 10, 30)).toEqual({ page: 1, per: 10, from: 0, to: 9 });
    expect(parsePaging(q("page=3&per=5"), 10, 30)).toEqual({ page: 3, per: 5, from: 10, to: 14 });
    expect(parsePaging(q("per=999"), 10, 30).per).toBe(30);
    expect(parsePaging(q("page=-2&per=abc"), 10, 30)).toMatchObject({ page: 1, per: 10 });
  });
});

describe("cổng share_sections", () => {
  it.each([
    ["posts", "board"],
    ["post", "board"],
    ["events", "events"],
    ["heritage", "heritage"],
    ["heritage_item", "heritage"],
    ["graves", "graves"],
    ["honor", "honor"],
    ["info", "info"],
    ["map", "map"],
    ["mosaic", "mosaic"],
  ])("part=%s chỉ chạy khi khoá %s bật", async (part, key) => {
    const GATE = { error: "Mục này không được chia sẻ." };
    const { sb, calls } = fakeSb({});
    const off = await handlePart(ctx(sb, []), part, q(`id=${ID}`));
    expect(off).toEqual({ status: 404, body: GATE });
    expect(calls).toHaveLength(0); // chưa chạm DB khi mục tắt
    // khoá của phần khác không mở được phần này
    expect((await handlePart(ctx(sb, ["info", "map", "mosaic", "board", "events", "heritage", "graves", "honor"].filter((k) => k !== key)), part, q(`id=${ID}`))).body).toEqual(GATE);
    // bật đúng khoá thì qua cổng (có thể 200 hoặc "không còn", nhưng không phải thông báo của cổng)
    expect((await handlePart(ctx(sb, [key]), part, q(`id=${ID}`))).body).not.toEqual(GATE);
  });

  it("part lạ → 400; search_index với mục tắt trả rỗng", async () => {
    const { sb } = fakeSb({});
    expect((await handlePart(ctx(sb, ["board"]), "nope", q(""))).status).toBe(400);
    const r = await handlePart(ctx(sb, []), "search_index", q(""));
    expect(r).toEqual({ status: 200, body: { items: [] } });
  });
});

describe("part=posts", () => {
  const rows = [
    {
      id: "p1",
      type: "news",
      title: null,
      body: "## Giỗ tổ\n![a](https://a.vn/1.jpg)\n**Mời** cả nhà về dự",
      pinned: true,
      created_at: "2026-11-20T00:00:00Z",
    },
  ];

  it("trả danh sách gọn: đoạn trích + ảnh bìa, KHÔNG trả body; chỉ bài đã đăng của đúng dòng họ", async () => {
    const { sb, calls } = fakeSb({ clan_posts: { data: rows, count: 41 } });
    const r = await handlePart(ctx(sb, ["board"]), "posts", q("page=2&per=10"));
    expect(r.status).toBe(200);
    const body = r.body as { items: Record<string, unknown>[]; total: number; page: number; per: number };
    expect(body).toMatchObject({ total: 41, page: 2, per: 10 });
    expect(body.items[0]).toMatchObject({ id: "p1", title: "Giỗ tổ", cover: "https://a.vn/1.jpg", pinned: true });
    expect(body.items[0]).not.toHaveProperty("body");
    expect(String(body.items[0].excerpt)).toContain("Mời cả nhà về dự");
    expect(calls[0].eq).toEqual(expect.arrayContaining([["clan_id", "clan-1"], ["status", "published"]]));
    expect(calls[0].range).toEqual([10, 19]);
  });

  it("ẩn ảnh bìa khi dòng họ bật ẩn ảnh; type sai → 400", async () => {
    const { sb } = fakeSb({ clan_posts: { data: rows } });
    const r = await handlePart(ctx(sb, ["board"], { hidePhotos: true }), "posts", q(""));
    expect((r.body as { items: { cover: unknown }[] }).items[0].cover).toBeNull();
    expect((await handlePart(ctx(sb, ["board"]), "posts", q("type=xyz"))).status).toBe(400);
  });
});

describe("part=post", () => {
  it("id sai định dạng → 400; không có / chưa đăng → 404", async () => {
    const { sb } = fakeSb({});
    expect((await handlePart(ctx(sb, ["board"]), "post", q("id=abc"))).status).toBe(400);
    expect((await handlePart(ctx(sb, ["board"]), "post", q(`id=${ID}`))).status).toBe(404);
  });

  it("trả toàn văn markdown + bài trước/sau, lọc đúng dòng họ và trạng thái", async () => {
    const post = { id: ID, type: "event", title: "Họp họ", body: "Nội dung\nxuống dòng", pinned: false, created_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-21T00:00:00Z" };
    const { sb, calls } = fakeSb({ clan_posts: { single: post } });
    const r = await handlePart(ctx(sb, ["board"]), "post", q(`id=${ID}`));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: ID, title: "Họp họ", body: "Nội dung\nxuống dòng", read_minutes: 1 });
    // 1 truy vấn bài + 2 truy vấn láng giềng, cả ba đều khoá theo dòng họ và trạng thái đã đăng
    expect(calls).toHaveLength(3);
    for (const c of calls) expect(c.eq).toEqual(expect.arrayContaining([["clan_id", "clan-1"], ["status", "published"]]));
  });
});

describe("part=info", () => {
  it("trả mô tả + thông tin sách họ (quê gốc, từ đường, giỗ tổ, trưởng họ)", async () => {
    const { sb, calls } = fakeSb({
      clans: { single: { description: "Mô tả họ" } },
      clan_book_texts: { single: { origin_place: "Tức Mặc", ancestral_hall: "Đền Thiên Trường", ancestor_anniversary: "20/8 ÂL", chief_name: "Ông A" } },
    });
    const r = await handlePart(ctx(sb, ["info"]), "info", q(""));
    expect(r).toEqual({
      status: 200,
      body: { description: "Mô tả họ", origin_place: "Tức Mặc", ancestral_hall: "Đền Thiên Trường", ancestor_anniversary: "20/8 ÂL", chief_name: "Ông A" },
    });
    expect(calls.map((c) => c.table).sort()).toEqual(["clan_book_texts", "clans"]);
  });

  it("họ chưa nhập gì → các trường null, không lỗi", async () => {
    const { sb } = fakeSb({});
    const r = await handlePart(ctx(sb, ["info"]), "info", q(""));
    expect(r.body).toEqual({ description: null, origin_place: null, ancestral_hall: null, ancestor_anniversary: null, chief_name: null });
  });
});

describe("part=map", () => {
  it("chỉ trả số đếm theo tỉnh + tên tỉnh — không địa chỉ, không tên người", async () => {
    const { sb, calls } = fakeSb({
      person_addresses: { data: [{ province_code: "37" }, { province_code: "37" }, { province_code: "01" }] },
      resting_places: { data: [{ province_code: "33" }] },
      vn_provinces: { data: [{ code: "37", name: "Ninh Bình" }, { code: "01", name: "Hà Nội" }, { code: "33", name: "Hưng Yên" }] },
    });
    const r = await handlePart(ctx(sb, ["map"]), "map", q(""));
    expect(r).toEqual({
      status: 200,
      body: { people: { "37": 2, "01": 1 }, graves: { "33": 1 }, province_names: { "37": "Ninh Bình", "01": "Hà Nội", "33": "Hưng Yên" } },
    });
    // chỉ chọn cột mã tỉnh, không kéo địa chỉ chi tiết / tên người
    const selects = calls.map((c) => c.select ?? "").join(" ");
    for (const k of ["street_detail", "ward_code", "person_id", "full_name"]) expect(selects).not.toContain(k);
  });
});

describe("part=mosaic", () => {
  const m = { id: "m1", title: "Ảnh của họ", description: null, cols: 8, slots: 56 };
  it("bức mới nhất + mảnh đã duyệt; ảnh ngoài dùng thẳng, ảnh trong kho được ký", async () => {
    const { sb, calls } = fakeSb({
      clan_mosaics: { single: m },
      clan_mosaic_tiles: { data: [{ position: 0, photo_path: "https://a.vn/1.jpg", caption: "Ông" }, { position: 3, photo_path: "c1/mosaic/x.jpg", caption: null }] },
    });
    const r = await handlePart(ctx(sb, ["mosaic"], { sign: async () => new Map([["c1/mosaic/x.jpg", "/storage/signed/x.jpg"]]) }), "mosaic", q(""));
    expect(r.body).toEqual({
      mosaic: {
        title: "Ảnh của họ", description: null, cols: 8, slots: 56,
        tiles: [{ position: 0, caption: "Ông", photo_url: "https://a.vn/1.jpg" }, { position: 3, caption: null, photo_url: "/storage/signed/x.jpg" }],
      },
    });
    expect(calls[1].eq).toEqual(expect.arrayContaining([["mosaic_id", "m1"], ["status", "approved"]]));
  });

  it("dòng họ bật ẩn ảnh → không trả ảnh nào, và không chạm DB", async () => {
    const { sb, calls } = fakeSb({});
    const r = await handlePart(ctx(sb, ["mosaic"], { hidePhotos: true }), "mosaic", q(""));
    expect(r.body).toEqual({ mosaic: null });
    expect(calls).toHaveLength(0);
  });

  it("chưa có bức ảnh ghép nào → null", async () => {
    const { sb } = fakeSb({});
    expect((await handlePart(ctx(sb, ["mosaic"]), "mosaic", q(""))).body).toEqual({ mosaic: null });
  });
});

describe("part=person (hồ sơ người)", () => {
  const dead = {
    id: ID, full_name: "Trần Quốc Tuấn", generation: 6, is_living: false, courtesy_name: "Tự X", posthumous_name: "Thụy Y", nickname: null,
    birth_place: "Tức Mặc", burial_place: "Kiếp Bạc", bio: "Tiểu sử dài.", birth_lunar_year: 1228, birth_lunar_month: null, birth_lunar_day: null,
    death_lunar_year: 1300, death_lunar_month: 8, death_lunar_day: 20,
  };
  const tables = (over: Record<string, { data?: unknown; single?: unknown }> = {}) => ({
    persons: { single: dead },
    clan_timeline_milestones: { data: [{ year: 1288, era: null, title: "Bạch Đằng", body: null }] },
    clan_posts: { data: [{ id: "p1", type: "news", title: null, body: "## Bài về ông\nChi tiết", created_at: "2026-11-20T00:00:00Z" }] },
    heritage_people: { data: [{ role_note: "Tác giả", item: { id: "h1", category: "artifact", title: "Hịch tướng sĩ", status: "active", deleted_at: null } }, { role_note: null, item: { id: "h2", category: "story", title: "Mục nháp", status: "draft", deleted_at: null } }, { role_note: null, item: { id: "h3", category: "story", title: "Mục đã xoá", status: "active", deleted_at: "2026-01-01" } }] },
    resting_place_occupants: { data: [{ place: { id: "g1", kind: "grave", name: "Thọ Lăng", location_name: "hương Tinh Cương", status: "existing", deleted_at: null } }, { place: { id: "g2", kind: "grave", name: "Đã xoá", location_name: null, status: "lost", deleted_at: "2026-01-01" } }] },
    ...over,
  });
  const pctx = (sb: unknown, sections: string[], over: Partial<PartCtx> = {}) => ctx(sb, sections, over);

  it("id sai định dạng → 400; không có người → 404", async () => {
    const { sb } = fakeSb({});
    expect((await handlePart(pctx(sb, []), "person", q("id=abc"))).status).toBe(400);
    expect((await handlePart(pctx(sb, []), "person", q(`id=${ID}`))).status).toBe(404);
  });

  it("người còn sống chỉ trả tên + đời, không chạm bảng chi tiết", async () => {
    const { sb, calls } = fakeSb({ persons: { single: { ...dead, is_living: true } } });
    const r = await handlePart(pctx(sb, ["board", "heritage", "graves", "profiles"], { publicChannel: true }), "person", q(`id=${ID}`));
    expect(r).toEqual({ status: 200, body: { living: true, id: ID, full_name: "Trần Quốc Tuấn", generation: 6 } });
    expect(calls.map((c) => c.table)).toEqual(["persons"]);
  });

  it("kênh công khai: đủ tiểu sử, dấu mốc, bài viết, di sản (bỏ nháp + đã xoá), nơi an nghỉ (bỏ đã xoá)", async () => {
    const { sb } = fakeSb(tables());
    const r = await handlePart(pctx(sb, ["board", "heritage", "graves"], { publicChannel: true }), "person", q(`id=${ID}`));
    expect(r.status).toBe(200);
    const b = r.body as Record<string, unknown> & { milestones: unknown[]; posts: { title: string }[]; heritage: { id: string }[]; graves: { id: string }[] };
    expect(b).toMatchObject({ profile: true, bio: "Tiểu sử dài.", burial_place: "Kiếp Bạc", courtesy_name: "Tự X", death_lunar: { year: 1300, month: 8, day: 20 } });
    expect(b.milestones).toHaveLength(1);
    expect(b.posts[0].title).toBe("Bài về ông");
    expect(b.heritage.map((h) => h.id)).toEqual(["h1"]);
    expect(b.graves.map((g) => g.id)).toEqual(["g1"]);
  });

  it("link token chưa bật khoá profiles: không tiểu sử / nơi chốn / dấu mốc và KHÔNG truy vấn dấu mốc", async () => {
    const { sb, calls } = fakeSb(tables());
    const r = await handlePart(pctx(sb, ["board"]), "person", q(`id=${ID}`));
    const b = r.body as Record<string, unknown> & { milestones: unknown[] };
    expect(b.profile).toBe(false);
    for (const k of ["bio", "birth_place", "burial_place", "courtesy_name", "death_lunar"]) expect(b).not.toHaveProperty(k);
    expect(b.milestones).toEqual([]);
    expect(calls.map((c) => c.table)).not.toContain("clan_timeline_milestones");
  });

  it("link token có khoá profiles thì được xem; các khối liên quan vẫn theo khoá board / heritage / graves", async () => {
    const { sb, calls } = fakeSb(tables());
    const r = await handlePart(pctx(sb, ["profiles"]), "person", q(`id=${ID}`));
    const b = r.body as Record<string, unknown> & { posts: unknown[]; heritage: unknown[]; graves: unknown[] };
    expect(b).toMatchObject({ profile: true, bio: "Tiểu sử dài." });
    expect(b.posts).toEqual([]);
    expect(b.heritage).toEqual([]);
    expect(b.graves).toEqual([]);
    expect(calls.map((c) => c.table)).not.toEqual(expect.arrayContaining(["clan_posts"]));
  });

  it("không chọn toạ độ / địa chỉ ở bất kỳ truy vấn nào", async () => {
    const { sb, calls } = fakeSb(tables());
    await handlePart(pctx(sb, ["board", "heritage", "graves"], { publicChannel: true }), "person", q(`id=${ID}`));
    const all = calls.map((c) => c.select ?? "").join(" ");
    for (const k of ["latitude", "longitude", "address", "location_detail"]) expect(all).not.toContain(k);
  });

  it("link giới hạn cây con: người ngoài phạm vi → 404, người trong phạm vi → xem được", async () => {
    const OUT = "22222222-2222-4222-8222-222222222222";
    const ROOT = "33333333-3333-4333-8333-333333333333";
    const mk = (personId: string) =>
      fakeSb(
        tables({
          persons: { single: { ...dead, id: personId }, data: [{ id: ROOT, birth_family_id: null }, { id: ID, birth_family_id: "f1" }, { id: OUT, birth_family_id: null }] },
          families: { data: [{ id: "f1", husband_id: ROOT, wife_id: null }] },
        }),
      );
    const c = { publicChannel: true, rootPersonId: ROOT };
    expect((await handlePart(pctx(mk(OUT).sb, [], c), "person", q(`id=${OUT}`))).status).toBe(404);
    expect((await handlePart(pctx(mk(ID).sb, [], c), "person", q(`id=${ID}`))).status).toBe(200);
  });
});

describe("part=graves", () => {
  it("không chọn toạ độ / địa chỉ, và chỉ liệt kê người ĐÃ MẤT, chưa bị xoá mềm", async () => {
    const data = [
      {
        id: "g1",
        kind: "grave",
        name: "Thọ Lăng",
        location_name: "hương Tinh Cương",
        status: "existing",
        built_year: null,
        resting_place_occupants: [
          { person: { full_name: "Trần Thừa", is_living: false } },
          { person: { full_name: "Người còn sống", is_living: true } },
          { person: { full_name: "Người đã xoá mềm", is_living: false, deleted_at: "2026-01-01" } },
        ],
      },
    ];
    const { sb, calls } = fakeSb({ resting_places: { data, count: 1 } });
    const r = await handlePart(ctx(sb, ["graves"]), "graves", q(""));
    const select = calls[0].select ?? "";
    for (const k of ["latitude", "longitude", "address", "location_detail"]) expect(select).not.toContain(k);
    const body = r.body as { items: { occupants: string[] }[]; total: number };
    expect(body.items[0].occupants).toEqual(["Trần Thừa"]);
    expect(body.total).toBe(1);
  });

  it("kind sai → 400", async () => {
    const { sb } = fakeSb({});
    expect((await handlePart(ctx(sb, ["graves"]), "graves", q("kind=xyz"))).status).toBe(400);
  });
});

describe("part=honor / heritage", () => {
  it("category sai → 400 cho cả hai", async () => {
    const { sb } = fakeSb({});
    expect((await handlePart(ctx(sb, ["honor"]), "honor", q("category=x"))).status).toBe(400);
    expect((await handlePart(ctx(sb, ["heritage"]), "heritage", q("category=x"))).status).toBe(400);
  });

  it("danh sách di sản chỉ lấy mục đang hoạt động, chưa xoá", async () => {
    const { sb, calls } = fakeSb({ heritage_items: { data: [], count: 0 } });
    await handlePart(ctx(sb, ["heritage"]), "heritage", q(""));
    expect(calls[0].eq).toEqual(expect.arrayContaining([["clan_id", "clan-1"], ["status", "active"]]));
    expect(calls[0].filters).toEqual(expect.arrayContaining([["is", "deleted_at", null]]));
  });
});

describe("loadHeritageItem / part=heritage_item", () => {
  const item = {
    id: ID,
    clan_id: "clan-1",
    category: "place",
    title: "Từ đường",
    body: "…",
    latitude: 20.4,
    longitude: 106.1,
    address: "số 1",
    status: "active",
    deleted_at: null,
    heritage_media: [],
    heritage_people: [
      { role_note: "người dựng", person: { full_name: "Trần Thừa", gender: "M", is_living: false } },
      { role_note: null, person: { full_name: "Bí mật", gender: "F", is_living: true } },
    ],
  };

  it("trang dòng họ bỏ toạ độ + địa chỉ, che tên người còn sống", async () => {
    const { sb } = fakeSb({ heritage_items: { single: item } });
    const r = await handlePart(ctx(sb, ["heritage"]), "heritage_item", q(`id=${ID}`));
    expect(r.status).toBe(200);
    const b = r.body as Record<string, unknown> & { people: { full_name: string }[] };
    for (const k of ["latitude", "longitude", "address", "status"]) expect(b).not.toHaveProperty(k);
    expect(b.people.map((p) => p.full_name)).toEqual(["Trần Thừa", "(Người đang sống)"]);
  });

  it("mục nháp hoặc của dòng họ khác → 404 trên trang dòng họ", async () => {
    const draft = fakeSb({ heritage_items: { single: { ...item, status: "draft" } } });
    expect((await handlePart(ctx(draft.sb, ["heritage"]), "heritage_item", q(`id=${ID}`))).status).toBe(404);
    const other = fakeSb({ heritage_items: { single: { ...item, clan_id: "clan-2" } } });
    expect((await handlePart(ctx(other.sb, ["heritage"]), "heritage_item", q(`id=${ID}`))).status).toBe(404);
  });

  it("link QR (không kiểm dòng họ, không lọc nháp) vẫn giữ toạ độ như cũ", async () => {
    const { sb } = fakeSb({ heritage_items: { single: { ...item, status: "draft" } } });
    const r = await loadHeritageItem(sb, ID, null, false);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ latitude: 20.4, longitude: 106.1, address: "số 1" });
  });
});
