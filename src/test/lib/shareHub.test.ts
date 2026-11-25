import { describe, expect, it } from "vitest";

import { buildHubItems, daysUntil, extendedExpiry, filterHubItems, hubItemUrl, hubStats, hubStatus, kindOfScope, type HubCardRow, type HubLinkRow, type HubNames } from "@/lib/shareHub";

const NOW = Date.parse("2026-11-25T00:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
const L = (over: Partial<HubLinkRow>): HubLinkRow => ({ id: "l1", token: "tok1", scope: "tree_view", root_person_id: null, root_resting_place_id: null, root_heritage_item_id: null, recipient_label: null, expires_at: day(30), is_revoked: false, created_at: "2026-11-01T00:00:00Z", ...over });
const C = (over: Partial<HubCardRow> = {}): HubCardRow => ({ id: "c1", token: "ctok", title: "Chào đón", subtitle: null, expires_at: day(12), created_at: "2026-11-20T00:00:00Z", view_count: 128, ...over });
const names: HubNames = { persons: new Map([["p1", "Trần Quốc Tuấn"]]), places: new Map([["g1", "Thọ Lăng"]]), heritage: new Map([["h1", "Hịch tướng sĩ"]]) };
const labels = { tree: "Cây", treeSub: "Cả họ", person: "Một người", personSub: "QR cá nhân", place: "Mộ", placeSub: "QR mộ", item: "Di sản", heritageSub: "QR di sản", contribute: "Mời góp", contributeSub: "Link mời góp", cardSub: "Thiệp khoe" };
const build = (links: HubLinkRow[], cards: HubCardRow[] = []) => buildHubItems(links, cards, names, labels);

describe("hubStatus", () => {
  it("thu hồi > hết hạn > sắp hết hạn (<= 7 ngày) > hoạt động", () => {
    expect(hubStatus(day(30), true, NOW)).toBe("revoked");
    expect(hubStatus(day(-1), false, NOW)).toBe("expired");
    expect(hubStatus(day(3), false, NOW)).toBe("expiring");
    expect(hubStatus(day(7), false, NOW)).toBe("expiring");
    expect(hubStatus(day(8), false, NOW)).toBe("active");
  });
  it("daysUntil làm tròn lên", () => expect(daysUntil(new Date(NOW + 3600_000).toISOString(), NOW)).toBe(1));
});

describe("kindOfScope", () => {
  it("ánh xạ scope; lạ → null", () => {
    expect(["tree_view", "single_person", "resting_place", "heritage_item", "contribute", "x"].map(kindOfScope)).toEqual(["tree", "person", "grave", "heritage", "contribute", null]);
  });
});

describe("buildHubItems", () => {
  it("tên đích theo loại; đường dẫn dẫn vào đúng mục menu; thiệp có lượt xem, link thì null", () => {
    const items = build(
      [L({ id: "a", scope: "single_person", root_person_id: "p1" }), L({ id: "b", scope: "resting_place", root_resting_place_id: "g1" }), L({ id: "c", scope: "heritage_item", root_heritage_item_id: "h1" }), L({ id: "d", scope: "contribute", recipient_label: " Cô Ba " }), L({ id: "e" })],
      [C()],
    );
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(by["link:a"]).toMatchObject({ kind: "person", title: "Trần Quốc Tuấn", path: "/share/tok1/nguoi/p1", views: null });
    expect(by["link:b"]).toMatchObject({ kind: "grave", title: "Thọ Lăng", path: "/share/tok1/mo-phan/g1" });
    expect(by["link:c"]).toMatchObject({ kind: "heritage", title: "Hịch tướng sĩ", path: "/share/tok1/di-san/h1" });
    expect(by["link:d"]).toMatchObject({ kind: "contribute", title: "Cô Ba", path: "/share/tok1/cung-gop" });
    expect(by["link:e"]).toMatchObject({ kind: "tree", title: "Cây", path: "/share/tok1" });
    expect(by["card:c1"]).toMatchObject({ kind: "card", views: 128, path: "/khoe/ctok", subtitle: "Thiệp khoe" });
  });

  it("đích đã xoá thì dùng tên chung; scope lạ bị bỏ; sắp mới nhất lên đầu", () => {
    const items = build([L({ id: "a", scope: "single_person", root_person_id: "gone", created_at: "2026-11-02T00:00:00Z" }), L({ id: "z", scope: "khac_la" }), L({ id: "n", created_at: "2026-11-10T00:00:00Z" })]);
    expect(items.map((i) => i.key)).toEqual(["link:n", "link:a"]);
    expect(items[1].title).toBe("Một người");
  });
});

describe("filterHubItems / hubStats", () => {
  const items = build(
    [L({ id: "a" }), L({ id: "b", scope: "single_person", root_person_id: "p1", expires_at: day(3) }), L({ id: "c", expires_at: day(-2) }), L({ id: "d", is_revoked: true })],
    [C()],
  );
  const f = (o: Partial<{ kind: "all" | "tree" | "person" | "card"; status: "active" | "all" | "ended"; search: string }> = {}) => filterHubItems(items, { kind: "all", status: "all", search: "", ...o }, NOW).map((i) => i.key).sort();

  it("trạng thái: hoạt động gồm cả sắp hết hạn; kết thúc gồm hết hạn + thu hồi", () => {
    expect(f({ status: "active" })).toEqual(["card:c1", "link:a", "link:b"]);
    expect(f({ status: "ended" })).toEqual(["link:c", "link:d"]);
    expect(f()).toHaveLength(5);
  });
  it("loại và tìm kiếm không dấu / không phân biệt hoa thường", () => {
    expect(f({ kind: "person" })).toEqual(["link:b"]);
    expect(f({ search: "tran quoc tuan" })).toEqual(["link:b"]);
    expect(f({ search: "CHAO DON" })).toEqual(["card:c1"]);
    expect(f({ search: "không có" })).toEqual([]);
  });
  it("thống kê", () => {
    expect(hubStats(items, NOW)).toEqual({ active: 3, total: 5, expiring: 1, cardViews: 128 });
  });
});

describe("extendedExpiry / hubItemUrl", () => {
  it("gia hạn từ hạn cũ nếu còn, từ bây giờ nếu đã hết", () => {
    expect(extendedExpiry(day(10), 30, NOW)).toBe(day(40));
    expect(extendedExpiry(day(-5), 30, NOW)).toBe(day(30));
  });
  it("url đầy đủ", () => expect(hubItemUrl("https://app.example/", { path: "/share/t" })).toBe("https://app.example/share/t"));
});
