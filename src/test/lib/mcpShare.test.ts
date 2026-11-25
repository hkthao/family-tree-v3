import { describe, expect, it, vi } from "vitest";

vi.mock("../../../mcp-server/src/book.tsx", () => ({ exportClanBook: vi.fn() }));
vi.mock("../../../mcp-server/src/photo.ts", () => ({ loadAvatar: vi.fn() }));

import { getClanInfo, listShareLinks, type Ctx } from "../../../mcp-server/src/ops";
import { MCP_TOOLS, scopeAllows } from "../../../mcp-server/src/specs";

/** Giả client Supabase: ghi lại bảng + cột được chọn, trả dữ liệu cố định. */
function fakeCtx(tables: Record<string, unknown>) {
  const selects: { table: string; cols: string }[] = [];
  const db = {
    from(table: string) {
      const rec = { table, cols: "" };
      selects.push(rec);
      const b: Record<string, unknown> = {};
      for (const m of ["eq", "order", "limit"]) b[m] = () => b;
      b.select = (cols: string) => ((rec.cols = cols), b);
      b.maybeSingle = () => Promise.resolve({ data: tables[table] ?? null, error: null });
      b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(res);
      return b;
    },
  };
  return { c: { db, clanId: "c1", userId: "u1", fresh: async () => db } as unknown as Ctx, selects };
}

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe("get_clan_info — phần hiển thị công khai (chỉ đọc)", () => {
  it("chọn thêm public_show_tree + share_sections và trả nguyên văn", async () => {
    const { c, selects } = fakeCtx({ clans: { id: "c1", name: "Nhà Trần", share_sections: ["board", "events", "profiles"], public_show_tree: true } });
    const out = JSON.parse(await getClanInfo(c));
    expect(selects[0].cols).toContain("share_sections");
    expect(selects[0].cols).toContain("public_show_tree");
    expect(out.share_sections).toEqual(["board", "events", "profiles"]);
  });
});

describe("list_share_links", () => {
  const links = [
    { id: "a", scope: "tree_view", root_person_id: null, recipient_label: null, expires_at: day(60), is_revoked: false, created_at: "2026-11-01T00:00:00Z", token: "SECRET-TOKEN-1", person: null },
    { id: "b", scope: "single_person", recipient_label: null, expires_at: day(3), is_revoked: false, created_at: "2026-11-02T00:00:00Z", token: "SECRET-TOKEN-2", person: { full_name: "Trần Quốc Tuấn" } },
    { id: "c", scope: "contribute", recipient_label: "Cô Ba", expires_at: day(30), is_revoked: true, created_at: "2026-11-03T00:00:00Z", person: null },
    { id: "e", scope: "resting_place", recipient_label: null, expires_at: day(40), is_revoked: false, created_at: "2026-11-05T00:00:00Z", person: null, place: { name: "Thọ Lăng" }, item: null },
    { id: "f", scope: "heritage_item", recipient_label: null, expires_at: day(40), is_revoked: false, created_at: "2026-11-06T00:00:00Z", person: null, place: null, item: { title: "Hịch tướng sĩ" } },
    { id: "d", scope: "scope_la", expires_at: day(30), is_revoked: false, created_at: "2026-11-04T00:00:00Z", person: null },
  ];
  const cards = [{ id: "k", title: "Chào đón", subtitle: null, expires_at: day(12), created_at: "2026-11-20T00:00:00Z", view_count: 128 }];

  it("liệt kê loại, đích, trạng thái, hạn, lượt xem thiệp — KHÔNG có token hay đường dẫn", async () => {
    const { c, selects } = fakeCtx({ share_links: links, card_shares: cards });
    const out = await listShareLinks(c, {});
    expect(out).toContain("card · Chào đón · active");
    expect(out).toContain("128 lượt xem");
    expect(out).toContain("person · Trần Quốc Tuấn · expiring");
    expect(out).toContain("contribute · Cô Ba · revoked");
    expect(out).toContain("tree · — · active");
    expect(out).toContain("grave · Thọ Lăng · active");
    expect(out).toContain("heritage · Hịch tướng sĩ · active");
    expect(out).not.toContain("scope_la"); // scope lạ bị bỏ
    expect(out).not.toMatch(/SECRET|\/share\/|\/khoe\//);
    // không bao giờ chọn cột token
    for (const s of selects) expect(s.cols).not.toMatch(/\btoken\b/);
  });

  it("active_only bỏ link đã thu hồi / hết hạn; chưa có gì thì nói rõ", async () => {
    const { c } = fakeCtx({ share_links: links, card_shares: cards });
    const out = await listShareLinks(c, { active_only: true });
    expect(out).not.toContain("revoked");
    const empty = fakeCtx({ share_links: [], card_shares: [] });
    expect(await listShareLinks(empty.c, {})).toContain("Chưa có link chia sẻ nào");
  });
});

describe("spec list_share_links", () => {
  const t = MCP_TOOLS.find((x) => x.name === "list_share_links")!;
  it("có trong danh sách tool, cần gói write (token chỉ-đọc không thấy), không có tham số ghi", () => {
    expect(t).toBeTruthy();
    expect(scopeAllows("read", t.needs)).toBe(false);
    expect(scopeAllows("write", t.needs)).toBe(true);
    expect(Object.keys(t.inputSchema.properties as object)).toEqual(["active_only"]);
    expect(t.description).toMatch(/WITHOUT tokens/);
  });
  it("không có tool tạo / thu hồi / gia hạn link chia sẻ", () => {
    for (const n of MCP_TOOLS.map((x) => x.name)) expect(n).not.toMatch(/(create|revoke|extend|delete)_share/);
  });
});
