import { describe, expect, it } from "vitest";

import { normalizePerson, parseFlexDate, PERSON_FIELDS, personProperties, UserError } from "../../../mcp-server/src/fields";
import { isBlockedIp } from "../../../mcp-server/src/photo";
import { MCP_ADMIN_TOOLS, MCP_TOOLS, scopeAllows, toolsForScope, withClanId } from "../../../mcp-server/src/specs";

describe("parseFlexDate", () => {
  it("nhận YYYY, YYYY-MM, YYYY-MM-DD và gán độ chính xác", () => {
    expect(parseFlexDate("1990", "d")).toEqual({ date: "1990-01-01", precision: "year" });
    expect(parseFlexDate("1990-05", "d")).toEqual({ date: "1990-05-01", precision: "month" });
    expect(parseFlexDate("1990-05-06", "d")).toEqual({ date: "1990-05-06", precision: "day" });
  });
  it("từ chối ngày ma và định dạng lạ", () => {
    for (const bad of ["1990-02-30", "1990-13-01", "90", "1990/05/06", "", 1990, null, "2100-01-01"]) {
      expect(() => parseFlexDate(bad, "d")).toThrow(UserError);
    }
  });
});

describe("normalizePerson", () => {
  it("chuẩn hoá nhiều trường, ngày kèm precision", () => {
    const out = normalizePerson({ full_name: "  Huỳnh A ", birth_date: "1990-05", birth_order: 1, birth_place: "Đắk Mil" }, { requireNameAndGender: false });
    expect(out).toMatchObject({ full_name: "Huỳnh A", birth_date: "1990-05-01", birth_date_precision: "month", birth_order: 1, birth_place: "Đắk Mil" });
  });
  it("null xoá trống trường cho phép, cấm với trường bắt buộc", () => {
    expect(normalizePerson({ birth_place: null, birth_date: null })).toMatchObject({ birth_place: null, birth_date: null, birth_date_precision: null });
    expect(() => normalizePerson({ full_name: null })).toThrow(UserError);
    expect(() => normalizePerson({ gender: null })).toThrow(UserError);
    expect(() => normalizePerson({ is_living: null })).toThrow(UserError);
  });
  it("chuỗi rỗng ở trường tuỳ chọn thành null", () => {
    expect(normalizePerson({ nickname: "   " })).toEqual({ nickname: null });
  });
  it("chỉ nhận trường trong danh sách — không cho đụng clan_id, id, photo_path, deleted_at…", () => {
    for (const k of ["clan_id", "id", "photo_path", "deleted_at", "birth_family_id", "generation", "is_root", "created_at", "version"]) {
      expect(() => normalizePerson({ [k]: "x" })).toThrow(UserError);
    }
  });
  it("kiểm kiểu và khoảng số", () => {
    expect(() => normalizePerson({ birth_order: 0 })).toThrow();
    expect(() => normalizePerson({ birth_order: 100 })).toThrow();
    expect(() => normalizePerson({ birth_order: 1.5 })).toThrow();
    expect(() => normalizePerson({ death_anniv_lunar_month: 13 })).toThrow();
    expect(() => normalizePerson({ death_anniv_lunar_day: 31 })).toThrow();
    expect(() => normalizePerson({ lifespan_years: 200 })).toThrow();
    expect(() => normalizePerson({ is_living: "true" })).toThrow();
    expect(() => normalizePerson({ gender: "X" })).toThrow();
    expect(() => normalizePerson({ branch_id: "không phải uuid" })).toThrow();
  });
  it("tạo mới bắt buộc tên + giới tính; sinh sau mất bị từ chối", () => {
    expect(() => normalizePerson({ full_name: "A" }, { requireNameAndGender: true })).toThrow(/gender/);
    expect(() => normalizePerson({ gender: "M" }, { requireNameAndGender: true })).toThrow(/full_name/);
    expect(() => normalizePerson({ birth_date: "1950", death_date: "1940" })).toThrow(/Ngày sinh muộn/);
    expect(() => normalizePerson({})).toThrow(UserError);
    expect(() => normalizePerson("x")).toThrow(UserError);
  });
});

describe("schema tool sinh từ cùng một nguồn", () => {
  it("personProperties khớp PERSON_FIELDS", () => {
    expect(Object.keys(personProperties()).sort()).toEqual(Object.keys(PERSON_FIELDS).sort());
  });
  it("update_person.changes và create_person dùng đủ các trường người", () => {
    const upd = MCP_TOOLS.find((t) => t.name === "update_person")!;
    const props = (upd.inputSchema.properties as any).changes.properties;
    expect(Object.keys(props).sort()).toEqual(Object.keys(PERSON_FIELDS).sort());
    const cre = MCP_TOOLS.find((t) => t.name === "create_person")!;
    for (const k of Object.keys(PERSON_FIELDS)) expect(cre.inputSchema.properties).toHaveProperty(k);
  });
  it("mọi tool xoá/gỡ bắt buộc confirm; tool đọc không cần quyền ghi", () => {
    for (const n of ["delete_person", "delete_branch", "delete_event"]) {
      expect(MCP_TOOLS.find((t) => t.name === n)!.inputSchema.required).toContain("confirm");
    }
    for (const n of ["list_persons", "get_tree", "list_branches", "list_events", "get_clan_info", "get_book_texts"]) {
      expect(scopeAllows("read", MCP_TOOLS.find((t) => t.name === n)!.needs)).toBe(true);
    }
    for (const n of ["create_person", "link_relation", "set_person_photo", "update_clan_info", "update_book_texts"]) {
      expect(scopeAllows("read", MCP_TOOLS.find((t) => t.name === n)!.needs)).toBe(false);
      expect(scopeAllows("propose", MCP_TOOLS.find((t) => t.name === n)!.needs)).toBe(false);
    }
  });
  it("export_clan_book là tool đọc (không ghi dữ liệu dòng họ), tuỳ chọn có giới hạn", () => {
    const t = MCP_TOOLS.find((x) => x.name === "export_clan_book")!;
    expect(t.needs).toBe("read");
    expect(t.inputSchema.additionalProperties).toBe(false);
    const props = t.inputSchema.properties as Record<string, any>;
    expect(props.watermark.enum).toEqual(["phoenix", "dragon", "none"]);
    expect(props.tree_per_page).toMatchObject({ minimum: 4, maximum: 60 });
  });
  it("update_clan_info chỉ có tên, mô tả, offset đời — không có quyền riêng tư/giới hạn", () => {
    const t = MCP_TOOLS.find((x) => x.name === "update_clan_info")!;
    expect(Object.keys(t.inputSchema.properties as object).sort()).toEqual(["description", "generation_offset", "name"]);
  });
});

describe("isBlockedIp (chống SSRF)", () => {
  it("chặn loopback, riêng tư, link-local, CGNAT, metadata, multicast, 0.0.0.0", () => {
    for (const ip of ["127.0.0.1", "127.1.2.3", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "100.127.255.255", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it("chặn IPv6 loopback, ULA, link-local, IPv4-mapped nội bộ", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it("cho địa chỉ công cộng", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
  it("giá trị không phải IP bị coi là chặn (an toàn mặc định)", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
  });
});

describe("token admin hệ thống", () => {
  it("ma trận quyền: admin gọi được tool đọc + ghi + quản trị + đề xuất (tổng hợp đóng góp luôn đi qua propose_*); gói khác không gọi được tool admin", () => {
    expect(scopeAllows("admin", "read")).toBe(true);
    expect(scopeAllows("admin", "write")).toBe(true);
    expect(scopeAllows("admin", "admin")).toBe(true);
    expect(scopeAllows("admin", "propose")).toBe(true);
    for (const s of ["read", "propose", "write"] as const) expect(scopeAllows(s, "admin")).toBe(false);
  });
  it("mọi tool quản trị đều needs=admin, tên admin_*, schema đóng", () => {
    expect(MCP_ADMIN_TOOLS.length).toBeGreaterThanOrEqual(20);
    for (const t of MCP_ADMIN_TOOLS) {
      expect(t.name.startsWith("admin_")).toBe(true);
      expect(t.needs).toBe("admin");
      expect(t.inputSchema.additionalProperties).toBe(false);
    }
    const names = MCP_ADMIN_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("tool nguy hiểm bắt buộc confirm + reason trong schema", () => {
    for (const n of ["admin_delete_announcement", "admin_revoke_api_token"]) {
      const t = MCP_ADMIN_TOOLS.find((x) => x.name === n)!;
      expect(t.inputSchema.required).toEqual(expect.arrayContaining(["confirm", "reason"]));
    }
    const ua = MCP_ADMIN_TOOLS.find((x) => x.name === "admin_user_action")!;
    expect((ua.inputSchema.properties as any).action.enum).toEqual(["suspend", "unsuspend", "signout"]);
    expect(ua.inputSchema.properties).toHaveProperty("confirm");
    expect(ua.inputSchema.properties).toHaveProperty("reason");
  });
  it("không có tool đổi cấu hình nền tảng hay xoá tài khoản / cấp quyền admin (chống prompt injection)", () => {
    const names = MCP_ADMIN_TOOLS.map((t) => t.name);
    expect(names).not.toContain("admin_set_setting");
    const ua = MCP_ADMIN_TOOLS.find((x) => x.name === "admin_user_action")!;
    const actions = (ua.inputSchema.properties as any).action.enum as string[];
    for (const bad of ["delete", "grant_platform_admin", "revoke_platform_admin"]) expect(actions).not.toContain(bad);
  });
  it("không có tool xoá dòng họ / xoá sạch danh mục", () => {
    const names = MCP_ADMIN_TOOLS.map((t) => t.name).join(" ");
    expect(names).not.toMatch(/delete_clan|wipe|purge|drop/);
  });
  it("toolsForScope(admin): tool theo dòng họ có `clan` (tên hoặc mã) bắt buộc, không có propose_*, kèm tool admin", () => {
    const tools = toolsForScope("admin");
    expect(tools.some((t) => t.name.startsWith("propose_"))).toBe(false);
    expect(tools.some((t) => t.name === "admin_list_clans")).toBe(true);
    for (const n of ["get_person", "create_person", "export_clan_book", "list_branches"]) {
      const t = tools.find((x) => x.name === n)!;
      expect(t.inputSchema.required).toContain("clan");
      expect(t.inputSchema.properties).toHaveProperty("clan");
    }
    // list_my_clans là tool chung, không đòi chọn họ trước.
    expect(tools.find((x) => x.name === "list_my_clans")!.inputSchema.required ?? []).not.toContain("clan");
  });
  it("token dòng họ không thấy tool admin_*; withClanId không làm đổi tool gốc", () => {
    for (const s of ["read", "propose", "write"] as const) expect(toolsForScope(s).some((t) => t.name.startsWith("admin_"))).toBe(false);
    const base = MCP_TOOLS.find((t) => t.name === "clan_stats")!;
    const wrapped = withClanId(base);
    expect((base.inputSchema.properties as object)).not.toHaveProperty("clan");
    expect(wrapped.inputSchema.properties).toHaveProperty("clan");
  });
});
