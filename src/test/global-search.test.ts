import { describe, expect, it } from "vitest";

import {
  PAGE_ENTRIES,
  POLICY_ENTRIES,
  filterEntries,
  guideEntries,
} from "@/lib/globalSearchStatic";
import { SEARCH_KIND_ORDER, hitPath, type SearchHit } from "@/lib/queries/global-search";

const hit = (kind: SearchHit["kind"], over: Partial<SearchHit> = {}): SearchHit => ({
  kind,
  id: "x1",
  clanId: "c1",
  clanName: "Họ A",
  title: "t",
  subtitle: null,
  ...over,
});

describe("hitPath", () => {
  it("trỏ đúng trang cho từng loại", () => {
    expect(hitPath(hit("person"))).toBe("/clans/c1/people/x1");
    expect(hitPath(hit("clan", { clanId: "c1", id: "c1" }))).toBe("/clans/c1");
    expect(hitPath(hit("grave"))).toBe("/clans/c1/graves/x1");
    expect(hitPath(hit("heritage"))).toBe("/clans/c1/heritage/x1");
    expect(hitPath(hit("event"))).toBe("/clans/c1/events");
    expect(hitPath(hit("post"))).toBe("/clans/c1/board/x1");
    expect(hitPath(hit("contribution"))).toBe("/clans/c1/contributions/x1");
    expect(hitPath(hit("inlaw"))).toBe("/clans/c1/inlaws");
    expect(hitPath(hit("custom", { clanId: null }))).toBe("/so-tay/x1");
  });

  it("mọi loại đều có nhãn nhóm", () => {
    const kinds = SEARCH_KIND_ORDER.map((k) => k.kind);
    expect(new Set(kinds).size).toBe(9);
  });
});

describe("filterEntries", () => {
  it("không phân biệt dấu, tiêu đề khớp đầu xếp trước", () => {
    const r = filterEntries(POLICY_ENTRIES, "quyen rieng tu");
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((e) => e.to === "/chinh-sach-rieng-tu")).toBe(true);
  });

  it("tìm được hướng dẫn sử dụng và trang quy định", () => {
    expect(guideEntries().length).toBeGreaterThan(5);
    expect(filterEntries(guideEntries(), "đăng nhập").length).toBeGreaterThan(0);
    expect(filterEntries(PAGE_ENTRIES, "lien he")[0]?.to).toBe("/lien-he");
  });

  it("bỏ qua từ khoá quá ngắn", () => {
    expect(filterEntries(POLICY_ENTRIES, "q")).toEqual([]);
  });
});
