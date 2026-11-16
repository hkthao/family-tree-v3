import { describe, expect, it } from "vitest";

import {
  isValidDate,
  validateChanges,
  validateNewPerson,
  validateNote,
} from "../../../mcp-server/src/proposals";
import { EDITABLE_FIELDS, MCP_TOOLS, scopeAllows } from "../../../mcp-server/src/specs";

const UUID = "0b7f3c9e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

describe("mcp specs", () => {
  it("tên tool duy nhất, schema là object", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of MCP_TOOLS) expect(t.inputSchema.type).toBe("object");
  });

  it("phân gói: read thấy tool đọc; propose/write loại trừ nhau", () => {
    const names = (scope: "read" | "propose" | "write") =>
      MCP_TOOLS.filter((t) => scopeAllows(scope, t.needs)).map((t) => t.name);
    for (const n of ["propose_add_person", "create_person", "update_person", "delete_person", "append_person_note", "set_person_photo", "link_relation", "create_branch", "update_clan_info"]) {
      expect(names("read")).not.toContain(n);
    }
    expect(names("propose")).toContain("propose_add_person");
    expect(names("propose")).not.toContain("delete_person");
    expect(names("write")).toContain("delete_person");
    expect(names("write")).not.toContain("propose_add_person");
  });

  it("tool ghi thẳng bắt buộc có confirm khi xoá", () => {
    const del = MCP_TOOLS.find((t) => t.name === "delete_person")!;
    expect(del.inputSchema.required).toContain("confirm");
  });

  it("changes trong schema khớp EDITABLE_FIELDS", () => {
    const edit = MCP_TOOLS.find((t) => t.name === "propose_edit_person")!;
    const props = (edit.inputSchema.properties as any).changes.properties;
    expect(Object.keys(props).sort()).toEqual([...EDITABLE_FIELDS].sort());
  });
});

describe("isValidDate", () => {
  it("chấp nhận ngày thật, từ chối ngày ma", () => {
    expect(isValidDate("1941-02-29")).toBe(false);
    expect(isValidDate("1940-02-29")).toBe(true);
    expect(isValidDate("1940-13-01")).toBe(false);
    expect(isValidDate("1940")).toBe(false);
    expect(isValidDate(19400101)).toBe(false);
  });
});

describe("validateChanges", () => {
  it("giữ trường hợp lệ và thêm precision cho ngày", () => {
    const r = validateChanges({ full_name: " Nguyễn Văn A ", birth_date: "1940-01-02" });
    expect(r).toEqual({
      ok: true,
      value: { full_name: "Nguyễn Văn A", birth_date: "1940-01-02", birth_date_precision: "day" },
    });
  });
  it("từ chối trường lạ (không cho sửa clan_id, id…)", () => {
    expect(validateChanges({ clan_id: UUID }).ok).toBe(false);
    expect(validateChanges({ birth_family_id: UUID }).ok).toBe(false);
  });
  it("từ chối rỗng, sai kiểu, sinh sau mất", () => {
    expect(validateChanges({}).ok).toBe(false);
    expect(validateChanges("x").ok).toBe(false);
    expect(validateChanges({ gender: "X" }).ok).toBe(false);
    expect(validateChanges({ death_anniv_lunar_month: 13 }).ok).toBe(false);
    expect(validateChanges({ birth_date: "1950-01-01", death_date: "1940-01-01" }).ok).toBe(false);
  });
});

describe("validateNewPerson", () => {
  it("tối thiểu cần tên + giới tính", () => {
    expect(validateNewPerson({ full_name: "A" }).ok).toBe(false);
    expect(validateNewPerson({ full_name: "A", gender: "M" }).ok).toBe(true);
  });
  it("quan hệ phải đủ cặp và id đúng dạng UUID", () => {
    const base = { full_name: "A", gender: "F" };
    expect(validateNewPerson({ ...base, relation_as: "child" }).ok).toBe(false);
    expect(validateNewPerson({ ...base, relation_as: "parent", relation_of_person_id: UUID }).ok).toBe(false);
    expect(validateNewPerson({ ...base, relation_as: "child", relation_of_person_id: "x'; drop" }).ok).toBe(false);
    expect(validateNewPerson({ ...base, relation_as: "child", relation_of_person_id: UUID })).toMatchObject({
      ok: true,
      value: { relation: { as: "child", of_person_id: UUID } },
    });
  });
});

describe("validateNote", () => {
  it("từ chối rỗng và quá dài", () => {
    expect(validateNote("  ").ok).toBe(false);
    expect(validateNote("a".repeat(4001)).ok).toBe(false);
    expect(validateNote("ghi chú")).toEqual({ ok: true, value: "ghi chú" });
  });
});
