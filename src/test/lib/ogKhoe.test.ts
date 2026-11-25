import { describe, expect, it } from "vitest";

import { renderOgPost, type OgEnv } from "../../../supabase/functions/og-post/og";
import { cardImageUrl, renderOgKhoe, type OgKhoeEnv } from "../../../supabase/functions/og-khoe/og";

/**
 * og-khoe (docs/plan-thiep-khoe-design.md, mục 4.1) và og-post?kind=person: thẻ OG cho trình quét. Cổng phải khép kín
 * (thiệp hết hạn / không có → 404 trơn; người còn sống → 404, không lộ tên) và không để chữ người dùng chèn được mã.
 */

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
const ENV: OgKhoeEnv = { siteOrigin: "https://app.example", cardImageBase: "https://st.example/storage/v1/object/public/card-shares", defaultImage: "https://app.example/icons/og-banner.png", siteName: "Dòng Họ Việt" };

type Tables = Record<string, { single?: unknown; data?: unknown }>;
function fakeSb(tables: Tables, calls: { table: string; gt?: unknown[] }[] = []) {
  return {
    from(table: string) {
      const r = tables[table] ?? {};
      const c: { table: string; gt?: unknown[] } = { table };
      calls.push(c);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "lt", "order", "limit", "range", "not"]) b[m] = () => b;
      b.gt = (...a: unknown[]) => ((c.gt = a), b);
      b.maybeSingle = () => Promise.resolve({ data: r.single ?? null, error: null });
      b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: r.data ?? [], error: null }).then(res);
      return b;
    },
  };
}
const card: Record<string, unknown> = { title: "Chào đón <b>bé</b>", subtitle: "Đời 32 · Họ Trần", image_path: "c1/tok.png", clan_id: "c1", expires_at: "2999-01-01" };

describe("renderOgKhoe", () => {
  it("thiệp còn hạn: og:image là ảnh thiệp thật, noindex, chữ được thoát", async () => {
    const r = await renderOgKhoe(fakeSb({ card_shares: { single: card }, clans: { single: { name: "Nhà Trần" } } }), TOKEN, ENV);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.html).toContain('property="og:image" content="https://st.example/storage/v1/object/public/card-shares/c1/tok.png"');
    expect(r.html).toContain(`property="og:url" content="https://app.example/khoe/${TOKEN}"`);
    expect(r.html).toContain("noindex");
    expect(r.html).toContain("Chào đón &lt;b&gt;bé&lt;/b&gt; — Nhà Trần");
    expect(r.html).not.toContain("<b>bé</b>");
  });

  it("có ảnh OG riêng: og:image là ảnh OG kèm kích thước 1200×630; không có thì ảnh thiệp gốc, không khai kích thước", async () => {
    const withOg = await renderOgKhoe(fakeSb({ card_shares: { single: { ...card, og_image_path: "c1/tok-og.jpg" } }, clans: { single: { name: "Nhà Trần" } } }), TOKEN, ENV);
    expect(withOg.status === 200 && withOg.html).toContain('property="og:image" content="https://st.example/storage/v1/object/public/card-shares/c1/tok-og.jpg"');
    expect(withOg.status === 200 && withOg.html).toContain('property="og:image:width" content="1200"');
    expect(withOg.status === 200 && withOg.html).toContain('property="og:image:height" content="630"');
    const noOg = await renderOgKhoe(fakeSb({ card_shares: { single: { ...card, og_image_path: null } }, clans: { single: { name: "Nhà Trần" } } }), TOKEN, ENV);
    expect(noOg.status === 200 && noOg.html).toContain("card-shares/c1/tok.png");
    expect(noOg.status === 200 && noOg.html).not.toContain("og:image:width");
    const badOg = await renderOgKhoe(fakeSb({ card_shares: { single: { ...card, og_image_path: "../x.jpg" } }, clans: { single: { name: "Nhà Trần" } } }), TOKEN, ENV);
    expect(badOg.status === 200 && badOg.html).toContain("card-shares/c1/tok.png");
  });

  it("hết hạn / không có thiệp → 404; truy vấn có lọc expires_at > now", async () => {
    const calls: { table: string; gt?: unknown[] }[] = [];
    expect((await renderOgKhoe(fakeSb({}, calls), TOKEN, ENV)).status).toBe(404);
    expect(calls[0].gt?.[0]).toBe("expires_at");
  });

  it("token sai định dạng / thiếu → 404 mà không chạm DB", async () => {
    const calls: { table: string }[] = [];
    for (const t of [null, "", "ngan", "a/b/../c", `${TOKEN}'--`]) expect((await renderOgKhoe(fakeSb({}, calls), t, ENV)).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("thiếu tiêu đề / phụ đề thì có chữ mặc định; đường dẫn ảnh lạ rơi về ảnh chung", async () => {
    const r = await renderOgKhoe(fakeSb({ card_shares: { single: { ...card, title: " ", subtitle: null, image_path: "../x.png" } }, clans: { single: { name: "Nhà Trần" } } }), TOKEN, ENV);
    expect(r.status === 200 && r.html).toContain("Thiệp từ Nhà Trần — Nhà Trần");
    expect(r.status === 200 && r.html).toContain('property="og:image" content="https://app.example/icons/og-banner.png"');
  });
});

describe("cardImageUrl", () => {
  it("mã hoá từng đoạn, chặn thoát thư mục / đoạn rỗng", () => {
    expect(cardImageUrl("https://s/x/", "c 1/a b.png")).toBe("https://s/x/c%201/a%20b.png");
    for (const p of ["../a", "a//b", "a/./b", "", "/a"]) expect(cardImageUrl("https://s/x", p)).toBeNull();
  });
});

describe("og-post?kind=person", () => {
  const OENV: OgEnv = { siteOrigin: "https://app.example", defaultImage: "https://app.example/icons/og-banner.png", siteName: "Dòng Họ Việt" };
  const PID = "11111111-1111-4111-8111-111111111111";
  const live = { clan_id: "c1", scope: "tree_view", is_revoked: false, expires_at: "2999-01-01", root_person_id: null };
  const dead = { id: PID, full_name: "Trần Hưng Đạo", generation: 6, is_living: false, bio: "Tiểu sử <i>ngắn</i>.", courtesy_name: null, posthumous_name: null, nickname: null, birth_place: null, burial_place: null };
  const run = (tables: Tables, share: string[], extra: Record<string, unknown> = {}) =>
    renderOgPost(fakeSb({ share_links: { single: live }, clans: { single: { name: "Nhà Trần", hide_photos_in_share: false, share_sections: share } }, persons: { single: dead }, ...tables, ...extra }), { token: "tok", clan: null, id: PID, kind: "person" }, OENV);

  it("link có khoá profiles: mô tả lấy từ tiểu sử, og:type profile, noindex", async () => {
    const r = await run({}, ["profiles"]);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.html).toContain("Trần Hưng Đạo — Nhà Trần");
    expect(r.html).toContain('property="og:type" content="profile"');
    expect(r.html).toContain("Tiểu sử");
    expect(r.html).toContain(`/share/tok/nguoi/${PID}`);
    expect(r.noindex).toBe(true);
  });

  it("link chưa bật profiles: KHÔNG lộ tiểu sử trong mô tả", async () => {
    const r = await run({}, ["board"]);
    expect(r.status === 200 && r.html).toContain("Hồ sơ Trần Hưng Đạo trong gia phả Nhà Trần.");
    expect(r.status === 200 && r.html).not.toContain("Tiểu sử");
  });

  it("người còn sống → 404, không lộ tên", async () => {
    expect((await run({ persons: { single: { ...dead, is_living: true } } }, ["profiles"])).status).toBe(404);
  });

  it("link hết hạn → 404", async () => {
    expect((await run({ share_links: { single: { ...live, is_revoked: true } } }, ["profiles"])).status).toBe(404);
  });
});
