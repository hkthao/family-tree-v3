import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INDEX = {
  items: [
    { id: "hoi-chua-huong", title: "Lễ hội chùa Hương", aliases: ["trẩy hội"], short_description: "Hội xuân", category: "le_hoi", regions: ["Miền Bắc"], tags: [{ slug: "ha-noi", name: "Hà Nội" }], updated_at: "2026-11-24" },
    { id: "le-nhap-trach", title: "Lễ nhập trạch", aliases: ["nhà mới", "tân gia"], short_description: "Về nhà mới", category: "tho_cung", regions: ["Miền Nam"], tags: [], updated_at: "2026-11-24" },
  ],
};
const FULL = {
  "hoi-chua-huong": "le hoi chua huong tre hoi suoi yen",
  "le-nhap-trach": "le nhap trach nha moi tan gia bep lua",
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.endsWith("index.json") ? INDEX : u.endsWith("fulltext.json") ? FULL : u.endsWith("hoi-chua-huong.json") ? { ...INDEX.items[0], sections: [{ heading: "Ý nghĩa", body: "<p>x</p>" }], sources: [{ name: "A" }] } : null;
      return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("", { status: 404 });
    }),
  );
}

describe("Sổ tay đọc từ tệp tĩnh", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("liệt kê bài, lọc theo chủ đề và vùng", async () => {
    const { listCustomEntries } = await import("@/lib/queries/customs");
    expect((await listCustomEntries()).map((e) => e.id)).toEqual(["hoi-chua-huong", "le-nhap-trach"]);
    expect((await listCustomEntries({ category: "tho_cung" })).map((e) => e.id)).toEqual(["le-nhap-trach"]);
    expect((await listCustomEntries({ region: "Miền Bắc" })).map((e) => e.id)).toEqual(["hoi-chua-huong"]);
  });

  it("tìm không dấu theo tình huống và toàn văn", async () => {
    const { listCustomEntries } = await import("@/lib/queries/customs");
    expect((await listCustomEntries({ search: "nha moi" })).map((e) => e.id)).toEqual(["le-nhap-trach"]);
    expect((await listCustomEntries({ search: "suối yến" })).map((e) => e.id)).toEqual(["hoi-chua-huong"]);
    expect(await listCustomEntries({ search: "khong co gi" })).toEqual([]);
  });

  it("lấy một bài, bài liên quan; slug lạ hoặc không tồn tại trả null", async () => {
    const { getCustomEntry, getCustomEntriesByIds } = await import("@/lib/queries/customs");
    const e = await getCustomEntry("hoi-chua-huong");
    expect(e?.sections[0].heading).toBe("Ý nghĩa");
    expect(e?.sources[0].name).toBe("A");
    expect(await getCustomEntry("khong-co")).toBeNull();
    expect(await getCustomEntry("../etc/passwd")).toBeNull();
    expect((await getCustomEntriesByIds(["le-nhap-trach", "x"])).map((e) => e.id)).toEqual(["le-nhap-trach"]);
  });

  it("truy vấn Sổ tay tĩnh không được lưu bền, bookmark thì có", async () => {
    const { isStaticCustomsQuery } = await import("@/lib/queries/customs");
    expect(isStaticCustomsQuery(["customs", { debounced: "" }])).toBe(true);
    expect(isStaticCustomsQuery(["custom-entry", "le-vu-lan"])).toBe(true);
    expect(isStaticCustomsQuery(["custom-bookmarks", "u1"])).toBe(false);
    expect(isStaticCustomsQuery(["clans"])).toBe(false);
  });
});
