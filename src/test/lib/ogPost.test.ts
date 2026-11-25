import { describe, expect, it } from "vitest";

import { buildOgHtml, escapeHtml, postPageUrl, renderOgPost, type OgEnv } from "../../../supabase/functions/og-post/og";

/**
 * og-post (docs/plan-trang-dong-ho.md, mục 6b): thẻ OG cho trình quét. Phải đóng cổng y hệt share-view?part=post
 * (link hết hạn / thu hồi / mục Bảng tin tắt / bài chưa đăng → 404 trơn) và không để nội dung bài chèn được mã vào HTML.
 */

const ID = "11111111-1111-4111-8111-111111111111";
const ENV: OgEnv = { siteOrigin: "https://app.example", defaultImage: "https://app.example/icons/og-banner.png", siteName: "Dòng Họ Việt" };

type Tables = Record<string, { data?: unknown; single?: unknown }>;
function fakeSb(tables: Tables) {
  return {
    from(table: string) {
      const r = tables[table] ?? {};
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "lt", "gt", "order", "limit", "range", "not"]) b[m] = () => b;
      b.maybeSingle = () => Promise.resolve({ data: r.single ?? null, error: null });
      b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: r.data ?? [], error: null }).then(res);
      return b;
    },
  };
}

const live = { clan_id: "c1", scope: "tree_view", is_revoked: false, expires_at: "2999-01-01" };
const clan = { name: "Nhà Trần", hide_photos_in_share: false, share_sections: ["board"] };
const post = (over: Record<string, unknown> = {}) => ({
  id: ID, type: "news", title: "Họp họ cuối năm", pinned: false, created_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-20T00:00:00Z",
  body: "![bìa](https://img.example/a.jpg)\n\nMời cả nhà **về** dự họp.", ...over,
});
const run = (tables: Tables, params: { token?: string | null; clan?: string | null; id?: string | null } = {}) =>
  renderOgPost(fakeSb(tables), { token: "tok", clan: null, id: ID, ...params }, ENV);

describe("escapeHtml / postPageUrl / buildOgHtml", () => {
  it("thoát đủ ký tự đặc biệt", () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe("&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;");
  });

  it("địa chỉ bài: link token và dòng họ công khai; bỏ dấu / thừa ở gốc", () => {
    expect(postPageUrl("https://app.example/", { token: "a b", clan: null }, ID)).toBe(`https://app.example/share/a%20b/bang-tin/${ID}`);
    expect(postPageUrl("https://app.example", { token: null, clan: "c1" }, ID)).toBe(`https://app.example/xem/clans/c1/bang-tin/${ID}`);
  });

  it("HTML có đủ thẻ og/twitter/canonical/refresh; noindex chỉ khi được yêu cầu", () => {
    const base = { title: "T", description: "D", image: "https://i/x.png", url: "https://app.example/p", siteName: "S" };
    const html = buildOgHtml({ ...base, noindex: true });
    for (const k of ['property="og:title" content="T"', 'property="og:description" content="D"', 'property="og:image" content="https://i/x.png"', 'property="og:url" content="https://app.example/p"', 'name="twitter:card" content="summary_large_image"', 'rel="canonical"', 'http-equiv="refresh" content="0;url=https://app.example/p"', 'name="robots" content="noindex, nofollow"'])
      expect(html).toContain(k);
    expect(buildOgHtml({ ...base, noindex: false })).not.toContain("noindex");
  });
});

describe("renderOgPost", () => {
  it("bài hợp lệ: tiêu đề kèm tên họ, đoạn trích thuần chữ, ảnh bìa là ảnh https đầu tiên, link token → noindex", async () => {
    const r = await run({ share_links: { single: live }, clans: { single: clan }, clan_posts: { single: post() } });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.noindex).toBe(true);
    expect(r.html).toContain("<title>Họp họ cuối năm — Nhà Trần</title>");
    expect(r.html).toContain('property="og:description" content="Mời cả nhà về dự họp."');
    expect(r.html).toContain('property="og:image" content="https://img.example/a.jpg"');
    expect(r.html).toContain(`content="0;url=https://app.example/share/tok/bang-tin/${ID}"`);
  });

  it("dòng họ công khai (không token): cho lập chỉ mục; bài không ảnh dùng ảnh chung", async () => {
    const r = await run(
      { clans: { single: { ...clan, id: "c1", visibility: "public", public_show_tree: true } }, clan_posts: { single: post({ body: "Chỉ có chữ." }) } },
      { token: null, clan: "c1" },
    );
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.noindex).toBe(false);
    expect(r.html).toContain(`property="og:image" content="${ENV.defaultImage}"`);
    expect(r.html).not.toContain("noindex");
  });

  it("dòng họ bật ẩn ảnh: không dùng ảnh trong bài", async () => {
    const r = await run({ share_links: { single: live }, clans: { single: { ...clan, hide_photos_in_share: true } }, clan_posts: { single: post() } });
    expect(r.status === 200 && r.html.includes("img.example")).toBe(false);
  });

  it("nội dung bài không chèn được mã vào HTML", async () => {
    const r = await run({ share_links: { single: live }, clans: { single: clan }, clan_posts: { single: post({ title: `<img src=x onerror=alert(1)>`, body: `<script>alert(1)</script> chữ` }) } });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it.each([
    ["link không tồn tại", { share_links: {}, clans: { single: clan }, clan_posts: { single: post() } }],
    ["link bị thu hồi", { share_links: { single: { ...live, is_revoked: true } }, clans: { single: clan }, clan_posts: { single: post() } }],
    ["link hết hạn", { share_links: { single: { ...live, expires_at: "2000-01-01" } }, clans: { single: clan }, clan_posts: { single: post() } }],
    ["link QR một người (không phải xem cây)", { share_links: { single: { ...live, scope: "single_person" } }, clans: { single: clan }, clan_posts: { single: post() } }],
    ["mục Bảng tin đang tắt", { share_links: { single: live }, clans: { single: { ...clan, share_sections: ["heritage"] } }, clan_posts: { single: post() } }],
    ["bài không có / chưa đăng", { share_links: { single: live }, clans: { single: clan }, clan_posts: {} }],
  ] as [string, Tables][])("404 trơn khi %s", async (_n, tables) => {
    expect(await run(tables)).toEqual({ status: 404 });
  });

  it("thiếu tham số hoặc id sai định dạng → 404, không chạm DB", async () => {
    expect(await run({}, { id: "abc" })).toEqual({ status: 404 });
    expect(await run({}, { id: null })).toEqual({ status: 404 });
    expect(await run({}, { token: null, clan: null })).toEqual({ status: 404 });
  });

  it("dòng họ riêng tư (không token) → 404", async () => {
    const r = await run({ clans: { single: { ...clan, id: "c1", visibility: "private", public_show_tree: true } } }, { token: null, clan: "c1" });
    expect(r).toEqual({ status: 404 });
  });
});

describe("renderOgPost kind=clan (trang chủ dòng họ)", () => {
  const env: OgEnv = { ...ENV, cardImageBase: "https://files.example/card-shares" };
  const runClan = (tables: Tables, params: { token?: string | null; clan?: string | null } = {}) =>
    renderOgPost(fakeSb(tables), { token: "tok", clan: null, id: null, kind: "clan", ...params }, env);

  it("đã thiết kế ảnh: tên + mô tả + ảnh OG 1200×630 có ?v= để Facebook làm mới", async () => {
    const r = await runClan({
      share_links: { single: live },
      clans: { single: { name: "Họ Huỳnh", description: "Dòng họ ở **Bình Định**.", share_og_path: "c1/clan-og-1.jpg", share_og_updated_at: "2026-11-25T10:00:00Z" } },
    });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.noindex).toBe(true);
    expect(r.html).toContain('property="og:title" content="Gia phả Họ Huỳnh"');
    expect(r.html).toContain("https://files.example/card-shares/c1/clan-og-1.jpg?v=");
    expect(r.html).toContain('property="og:image:width" content="1200"');
    expect(r.html).toContain('property="og:url" content="https://app.example/share/tok"');
  });

  it("chưa thiết kế ảnh: thẻ chung, KHÔNG lộ tên dòng họ", async () => {
    const r = await runClan({ share_links: { single: live }, clans: { single: { name: "Họ Huỳnh", description: "bí mật", share_og_path: null } } });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.html).not.toContain("Họ Huỳnh");
    expect(r.html).not.toContain("bí mật");
    expect(r.html).toContain("https://app.example/icons/og-banner.png");
  });

  it("link hỏng / loại link không xem được cây / thiếu cả token lẫn clan → 404", async () => {
    expect((await runClan({ share_links: { single: { ...live, is_revoked: true } }, clans: { single: {} } })).status).toBe(404);
    expect((await runClan({ share_links: { single: { ...live, scope: "single_person" } }, clans: { single: {} } })).status).toBe(404);
    expect((await runClan({}, { token: null, clan: null })).status).toBe(404);
  });
});
