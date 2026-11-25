import { describe, expect, it } from "vitest";

import { buildEntries, loadSitemap, MAX_URLS, toXml } from "../../../supabase/functions/sitemap/core";

/**
 * Sitemap dòng họ công khai: chỉ trang cấp dòng họ mà admin đã bật; KHÔNG có trang cây / hồ sơ người; thoát ký tự XML; trong giới hạn 50.000 URL.
 */
const O = "https://app.example";
const clan = (id: string, sections: string[]) => ({ id, share_sections: sections, updated_at: "2026-11-20T10:00:00Z" });

describe("buildEntries", () => {
  it("trang chủ luôn có; mục nào bật mới có trang tương ứng; bài + di sản kèm lastmod", () => {
    const e = buildEntries(O, [clan("c1", ["board", "heritage", "graves"])], [{ id: "p1", clan_id: "c1", updated_at: "2026-11-21T00:00:00Z" }], [{ id: "h1", clan_id: "c1", updated_at: null }]);
    expect(e.map((x) => x.loc)).toEqual([
      `${O}/xem/clans/c1`, `${O}/xem/clans/c1/bang-tin`, `${O}/xem/clans/c1/bang-tin/p1`,
      `${O}/xem/clans/c1/di-san`, `${O}/xem/clans/c1/di-san/h1`, `${O}/xem/clans/c1/mo-phan`,
    ]);
    expect(e[0].lastmod).toBe("2026-11-20");
    expect(e[2].lastmod).toBe("2026-11-21");
    expect(e[4].lastmod).toBeUndefined();
  });

  it("không bật gì: chỉ trang chủ; bài của dòng họ khác không lẫn sang", () => {
    const e = buildEntries(O, [clan("c1", []), clan("c2", ["board"])], [{ id: "p9", clan_id: "c2", updated_at: null }], []);
    expect(e.filter((x) => x.loc.includes("/c1")).map((x) => x.loc)).toEqual([`${O}/xem/clans/c1`]);
    expect(e.some((x) => x.loc.includes("/c1/bang-tin"))).toBe(false);
    expect(e.some((x) => x.loc === `${O}/xem/clans/c2/bang-tin/p9`)).toBe(true);
  });

  it("KHÔNG bao giờ liệt kê trang cây / hồ sơ người dù mọi khoá đều bật", () => {
    const all = buildEntries(O, [clan("c1", ["info", "board", "events", "map", "heritage", "graves", "honor", "mosaic", "profiles"])], [], []);
    for (const x of all) expect(x.loc).not.toMatch(/\/cay|\/nguoi|\/cung-gop/);
  });

  it("cắt ở giới hạn số URL của một tệp", () => {
    const clans = Array.from({ length: MAX_URLS + 10 }, (_, i) => clan(`c${i}`, []));
    expect(buildEntries(O, clans, [], [])).toHaveLength(MAX_URLS);
  });
});

describe("toXml", () => {
  it("XML hợp lệ, thoát ký tự đặc biệt", () => {
    const x = toXml([{ loc: `${O}/a?x=1&y=<2>`, lastmod: "2026-11-20" }, { loc: `${O}/b` }]);
    expect(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(x).toContain("<loc>https://app.example/a?x=1&amp;y=&lt;2&gt;</loc><lastmod>2026-11-20</lastmod>");
    expect(x).toContain("<url><loc>https://app.example/b</loc></url>");
  });
});

describe("loadSitemap", () => {
  const fakeSb = (tables: Record<string, unknown[]>, calls: string[] = []) => ({
    from(t: string) {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "order", "limit"]) q[m] = (...a: unknown[]) => (m === "eq" ? calls.push(`${t}.${a[0]}=${String(a[1])}`) : 0, q);
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: tables[t] ?? [], error: null }).then(res);
      return q;
    },
  });
  it("chỉ lấy dòng họ công khai cho xem cây; bài đã đăng; di sản đang hoạt động; bỏ qua truy vấn khi không dòng họ nào bật mục", async () => {
    const calls: string[] = [];
    const xml = await loadSitemap(fakeSb({ clans: [clan("c1", ["board"])], clan_posts: [{ id: "p1", clan_id: "c1", updated_at: null }], heritage_items: [] }, calls), O);
    expect(calls).toContain("clans.visibility=public");
    expect(calls).toContain("clans.public_show_tree=true");
    expect(calls).toContain("clan_posts.status=published");
    expect(calls.some((c) => c.startsWith("heritage_items"))).toBe(false);
    expect(xml).toContain("/xem/clans/c1/bang-tin/p1");
  });
});
