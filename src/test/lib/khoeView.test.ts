import { describe, expect, it } from "vitest";

import { loadKhoe } from "../../../supabase/functions/share-view/khoe";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
function fakeSb(t: Record<string, unknown>, calls: string[] = []) {
  return {
    from(table: string) {
      calls.push(table);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gt"]) b[m] = () => b;
      b.maybeSingle = () => Promise.resolve({ data: t[table] ?? null, error: null });
      return b;
    },
  };
}
const card = { title: "T", subtitle: null, image_path: "c1/x.png", clan_id: "c1", expires_at: "2999-01-01" };

describe("share-view?khoe (loadKhoe)", () => {
  it("thiệp còn hạn: chỉ trả tiêu đề / phụ đề / ảnh / hạn + tên họ + cờ công khai cây", async () => {
    const r = await loadKhoe(fakeSb({ card_shares: card, clans: { name: "Nhà Trần", visibility: "public", public_show_tree: true } }), TOKEN);
    expect(r).toEqual({ status: 200, body: { clan_id: "c1", clan_name: "Nhà Trần", public_tree: true, card: { title: "T", subtitle: null, image_path: "c1/x.png", expires_at: "2999-01-01" } } });
    expect(Object.keys((r.body as { card: object }).card).sort()).toEqual(["expires_at", "image_path", "subtitle", "title"]);
  });

  it("họ riêng tư hoặc công khai nhưng không cho xem cây → public_tree=false", async () => {
    for (const c of [{ name: "A", visibility: "private", public_show_tree: true }, { name: "A", visibility: "public", public_show_tree: false }]) {
      const r = await loadKhoe(fakeSb({ card_shares: card, clans: c }), TOKEN);
      expect(r.status === 200 && r.body.public_tree).toBe(false);
    }
  });

  it("không có / hết hạn → 404; token sai định dạng → 404 mà không chạm DB", async () => {
    expect((await loadKhoe(fakeSb({}), TOKEN)).status).toBe(404);
    const calls: string[] = [];
    for (const t of [null, "", "ngan", "a/b"]) expect((await loadKhoe(fakeSb({ card_shares: card }, calls), t)).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});
