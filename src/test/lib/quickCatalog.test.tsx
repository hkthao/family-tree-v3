import { describe, expect, it } from "vitest";

import { buildQuickCatalog } from "@/lib/quickCatalog";
import { buildSections } from "@/lib/navModel";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { MyProfile } from "@/lib/queries/profile";

const clan = {
  id: "c1",
  name: "Họ Nguyễn",
  myRole: "admin",
  isPlatformAdmin: false,
  disabled_features: [],
  public_show_tree: true,
  share_sections: ["events", "graves", "heritage"],
} as unknown as ClanDetail;
const profile = { is_platform_admin: false } as unknown as MyProfile;
const sections = (c = clan) => buildSections("c1", c, profile, 0, 0, 0);
const keys = (c = clan, canEdit = true, isMember = true) =>
  buildQuickCatalog(sections(c), { clanId: "c1", canEdit, isMember }).map((e) => e.key);

describe("buildQuickCatalog", () => {
  it("bốn mục lõi đứng đầu theo đúng thứ tự, không có ô Tổng quan", () => {
    const k = keys();
    expect(k.slice(0, 4)).toEqual(["tree", "people", "relations", "events"]);
    expect(k).not.toContain("");
  });

  it("phần còn lại theo thứ tự ưu tiên mặc định", () => {
    const k = keys();
    expect(k.indexOf("people/new")).toBeLessThan(k.indexOf("todo"));
    expect(k.indexOf("todo")).toBeLessThan(k.indexOf("graves"));
    expect(k.indexOf("graves")).toBeLessThan(k.indexOf("board"));
  });

  it("đồng bộ với menu: tính năng đã tắt hoặc không có quyền thì không có trong danh mục", () => {
    const off = { ...clan, disabled_features: ["board", "memory_room"] } as unknown as ClanDetail;
    const k = keys(off);
    expect(k).not.toContain("board");
    expect(k).not.toContain("memory-room");
    const viewer = { ...clan, myRole: "viewer" } as unknown as ClanDetail;
    const kv = keys(viewer, false, true);
    expect(kv).not.toContain("settings");
    expect(kv).not.toContain("import");
    expect(kv).not.toContain("people/new");
  });

  it("thêm người cần quyền sửa; xuất PDF cần là thành viên", () => {
    expect(keys(clan, false, true)).not.toContain("people/new");
    expect(keys(clan, true, false)).not.toContain("pdf");
    expect(keys()).toContain("pdf");
  });

  it("không có khoá trùng", () => {
    const k = keys();
    expect(new Set(k).size).toBe(k.length);
  });

  it("nhãn ngắn một dòng cho các mục dài", () => {
    const cat = buildQuickCatalog(sections(), { clanId: "c1", canEdit: true, isMember: true });
    const short = (key: string) => cat.find((e) => e.key === key)!.short;
    expect(short("graves")).toBe("Mộ phần");
    expect(short("honor")).toBe("Bảng vàng");
    expect(short("todo")).toBe("Việc làm");
  });
});
