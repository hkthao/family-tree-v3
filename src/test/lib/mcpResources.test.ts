import { describe, expect, it } from "vitest";

import { TIMELINE_ICON_KEYS } from "@/components/timeline/TimelineIcon";
import { EXTRA_SPECS, RESOURCES, resourceSpecs, TIMELINE_ICONS } from "../../../mcp-server/src/resourceDefs";
import { RESOURCE_OPS, RESOURCE_TOOL_NAMES } from "../../../mcp-server/src/resources";
import { MCP_TOOLS, scopeAllows, toolsForScope, withClanId } from "../../../mcp-server/src/specs";

const NEW = [...resourceSpecs(), ...EXTRA_SPECS];
const WRITE_VERBS = /^(create|update|delete|add|remove|moderate|set)_/;

describe("tool CRUD cho Bảng tin / Phòng ký ức / Ảnh ghép / Di sản / Mộ phần / Quỹ họ / Bảng vàng / Bản đồ", () => {
  it("mọi tool mới nằm trong MCP_TOOLS, tên không trùng", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of NEW) expect(names, t.name).toContain(t.name);
  });

  it("mỗi tool mới có hàm thực thi và ngược lại (không có tool thiếu hàm / hàm mồ côi)", () => {
    expect([...NEW.map((t) => t.name)].sort()).toEqual([...RESOURCE_TOOL_NAMES].sort());
    for (const t of NEW) expect(typeof RESOURCE_OPS[t.name], t.name).toBe("function");
  });

  it("quyền theo gói: tool ghi cần 'write' (không phải propose/admin), tool đọc cần 'read'", () => {
    for (const t of NEW) {
      if (WRITE_VERBS.test(t.name)) expect(t.needs, t.name).toBe("write");
      else expect(t.needs, t.name).toBe("read"); // list_*, get, fund_summary, map_stats
    }
  });

  it("gói read / propose KHÔNG thấy bất kỳ tool ghi mới nào; gói write và admin thấy đủ", () => {
    const writeNames = NEW.filter((t) => t.needs === "write").map((t) => t.name);
    expect(writeNames.length).toBeGreaterThan(30);
    for (const s of ["read", "propose"] as const) {
      const have = new Set(toolsForScope(s).map((t) => t.name));
      for (const n of writeNames) expect(have.has(n), `${s} thấy ${n}`).toBe(false);
    }
    for (const s of ["write", "admin"] as const) {
      const have = new Set(toolsForScope(s).map((t) => t.name));
      for (const t of NEW) expect(have.has(t.name), `${s} thiếu ${t.name}`).toBe(true);
    }
    for (const t of NEW) {
      expect(scopeAllows("read", t.needs)).toBe(t.needs === "read");
      expect(scopeAllows("propose", t.needs)).toBe(t.needs === "read");
    }
  });

  it("schema đóng (không nhận tham số lạ); lệnh xoá/gỡ bắt buộc confirm", () => {
    for (const t of NEW) {
      expect((t.inputSchema as { additionalProperties?: boolean }).additionalProperties, t.name).toBe(false);
      if (/^(delete|remove)_/.test(t.name)) {
        expect((t.inputSchema as { required: string[] }).required, t.name).toContain("confirm");
      }
    }
  });

  it("không có tool nào cho ghi cột nhạy cảm: clan_id, deleted_at, created_by, author_id, status/pinned của bài, is_public", () => {
    const banned = ["clan_id", "deleted_at", "created_by", "author_id", "is_public", "owner_id", "user_id"];
    for (const r of RESOURCES) {
      for (const b of banned) expect(Object.keys(r.fields), `${r.key}.${b}`).not.toContain(b);
    }
    const post = RESOURCES.find((r) => r.key === "post")!;
    expect(Object.keys(post.fields)).not.toContain("status");
    expect(Object.keys(post.fields)).not.toContain("pinned");
  });

  it("kết nối nhiều họ: tool mới nhận `clan` bắt buộc; list_* theo id đọc được một mục đầy đủ", () => {
    for (const t of NEW) {
      const w = withClanId(t);
      expect((w.inputSchema as { required: string[] }).required, t.name).toContain("clan");
    }
    for (const r of RESOURCES) {
      const list = NEW.find((t) => t.name === `list_${r.plural}`)!;
      expect(Object.keys((list.inputSchema as { properties: object }).properties)).toContain("id");
    }
  });

  it("link ảnh/mô hình chỉ https; số liệu có khoảng hợp lệ", () => {
    const room = RESOURCES.find((r) => r.key === "memory_room")!;
    expect(room.fields.cover_image_url.k).toBe("url");
    const fund = RESOURCES.find((r) => r.key === "fund_transaction")!.fields.amount;
    expect(fund).toMatchObject({ k: "num", min: 0, gt: true });
    const mosaic = RESOURCES.find((r) => r.key === "mosaic")!.fields;
    expect(mosaic.cols).toMatchObject({ min: 2, max: 12 });
    expect(mosaic.slots).toMatchObject({ min: 4, max: 150 });
  });

  it("bộ icon của mốc dòng thời gian trong MCP trùng bộ icon của app (không lệch khi thêm icon mới)", () => {
    expect([...TIMELINE_ICONS].sort()).toEqual([...TIMELINE_ICON_KEYS].sort());
  });

  it("có đủ công cụ cho dòng thời gian và liên kết dòng họ", () => {
    const names = new Set(NEW.map((t) => t.name));
    for (const n of [
      "list_timeline_library",
      "list_timeline_milestones",
      "create_timeline_milestone",
      "update_timeline_milestone",
      "delete_timeline_milestone",
      "get_person_timeline",
      "set_person_timeline",
      "list_clan_links",
      "get_clan_link",
      "create_clan_link",
      "create_clan_link_from_token",
      "set_clan_link_status",
      "delete_clan_link",
    ]) expect(names.has(n), n).toBe(true);
  });
});
