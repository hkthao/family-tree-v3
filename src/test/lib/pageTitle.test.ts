import { describe, expect, it } from "vitest";

import { formatTitle, metaForPath, ROUTE_META } from "@/lib/pageTitle";

describe("metaForPath", () => {
  it("resolves specific routes before their prefixes", () => {
    expect(metaForPath("/clans/new")?.title).toBe("Tạo dòng họ mới");
    expect(metaForPath("/clans")?.title).toBe("Dòng họ của tôi");
    expect(metaForPath("/so-tay/new")?.title).toBe("Thêm bài Sổ tay");
    expect(metaForPath("/so-tay/abc/edit")?.title).toBe("Sửa bài Sổ tay");
    expect(metaForPath("/so-tay/abc")?.title).toBe("Sổ tay Văn hoá");
  });

  it("matches nested clan routes, deepest first", () => {
    const c = "/clans/69a6ac21-90ce-45fc-8a24-45f79521819b";
    expect(metaForPath(`${c}/people/def/edit`)?.title).toBe("Sửa thông tin");
    expect(metaForPath(`${c}/people/def`)?.title).toBe("Hồ sơ thành viên");
    expect(metaForPath(`${c}/people/new`)?.title).toBe("Thêm người");
    expect(metaForPath(`${c}/people`)?.title).toBe("Danh sách thành viên");
    expect(metaForPath(`${c}/tree`)?.title).toBe("Cây gia phả");
    expect(metaForPath(c)?.title).toBe("Tổng quan dòng họ");
  });

  it("returns null for an unknown path so the default title stands", () => {
    expect(metaForPath("/khong-ton-tai")).toBeNull();
  });
});

describe("noindex", () => {
  it("covers every capability-token route", () => {
    for (const p of [
      "/share/abc",
      "/join/abc",
      "/khoe/abc",
      "/inlaws/confirm/abc",
    ]) {
      expect(metaForPath(p)?.noindex, p).toBe(true);
    }
  });

  it("leaves public pages indexable, with a description to rank on", () => {
    const clan = metaForPath("/xem/clans/69a6ac21-90ce-45fc-8a24-45f79521819b");
    expect(clan?.noindex).toBeUndefined();
    expect(clan?.description).toBeTruthy();
    expect(metaForPath("/so-tay")?.description).toBeTruthy();
    expect(metaForPath("/xem/so-tay/abc")?.description).toBeTruthy();
  });

  it("never pairs noindex with a description — wasted copy", () => {
    for (const m of ROUTE_META) {
      if (m.noindex) expect(m.description, m.pattern).toBeUndefined();
    }
  });
});

describe("formatTitle", () => {
  it("appends the site name", () => {
    expect(formatTitle("Cây gia phả")).toBe("Cây gia phả — Dòng Họ Việt");
  });

  it("falls back to the full default when empty", () => {
    expect(formatTitle("")).toBe("Dòng Họ Việt — Quản lý gia phả dòng họ");
    expect(formatTitle(null)).toBe("Dòng Họ Việt — Quản lý gia phả dòng họ");
  });

  it("does not repeat the site name", () => {
    expect(formatTitle("Dòng Họ Việt")).toBe(
      "Dòng Họ Việt — Quản lý gia phả dòng họ",
    );
  });
});
