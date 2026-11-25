import { describe, expect, it } from "vitest";

import { buildSiteMenu, isPageVisible, isSiteScope, resolveSiteFlag, sitePageFromSub, sitePagePath } from "@/lib/siteSections";

/**
 * Ánh xạ trang ↔ khoá `share_sections` (docs/plan-trang-dong-ho.md, mục 2.2). Lệch ánh xạ thì menu hiện
 * một trang mà dữ liệu bị tắt (trang rỗng) hoặc giấu một trang admin đã bật.
 */
describe("isPageVisible", () => {
  it("Trang chủ và Cây luôn có, kể cả khi không bật khoá nào", () => {
    expect(isPageVisible("home", [])).toBe(true);
    expect(isPageVisible("tree", [])).toBe(true);
  });

  it("mỗi trang theo đúng một khoá", () => {
    const cases = [
      ["board", "board"],
      ["events", "events"],
      ["heritage", "heritage"],
      ["graves", "graves"],
      ["honor", "honor"],
    ] as const;
    for (const [page, key] of cases) {
      expect(isPageVisible(page, [])).toBe(false);
      expect(isPageVisible(page, [key])).toBe(true);
      // khoá của trang khác không bật được trang này
      expect(isPageVisible(page, cases.filter(([, k]) => k !== key).map(([, k]) => k))).toBe(false);
    }
  });

  it("Cùng góp theo quyền của link, không theo khoá", () => {
    expect(isPageVisible("contribute", ["board", "events"])).toBe(false);
    expect(isPageVisible("contribute", [], { canContribute: true })).toBe(true);
  });

  it("khoá info/map/mosaic chỉ nằm ở Trang chủ, không bật trang riêng", () => {
    for (const p of ["board", "events", "heritage", "graves", "honor"] as const) {
      expect(isPageVisible(p, ["info", "map", "mosaic"])).toBe(false);
    }
  });
});

describe("buildSiteMenu", () => {
  const pages = (m: ReturnType<typeof buildSiteMenu>) =>
    m.map((e) => (e.kind === "page" ? e.page : `group:${e.pages.join("+")}`));

  it("mọi khoá bật: 4 mục, nhóm Di sản, Cùng góp", () => {
    expect(
      pages(buildSiteMenu(["board", "events", "heritage", "graves", "honor"], { canContribute: true })),
    ).toEqual(["home", "board", "tree", "events", "group:heritage+graves+honor", "contribute"]);
  });

  it("không bật gì: chỉ Trang chủ và Cây", () => {
    expect(pages(buildSiteMenu([]))).toEqual(["home", "tree"]);
  });

  it("nhóm còn một trang thì hiện thẳng trang đó, không thả xuống", () => {
    expect(pages(buildSiteMenu(["graves"]))).toEqual(["home", "tree", "graves"]);
  });

  it("nhóm giữ thứ tự Di sản, Mộ phần, Bảng vàng dù khoá bật theo thứ tự nào", () => {
    expect(pages(buildSiteMenu(["honor", "heritage"]))).toEqual(["home", "tree", "group:heritage+honor"]);
  });

  it("bỏ Bảng tin khi khoá board tắt", () => {
    expect(pages(buildSiteMenu(["events"]))).toEqual(["home", "tree", "events"]);
  });
});


describe("đường dẫn trang dòng họ", () => {
  it("dựng đường dẫn từ gốc, có hoặc không có id", () => {
    expect(sitePagePath("/share/abc", "home")).toBe("/share/abc");
    expect(sitePagePath("/share/abc", "board")).toBe("/share/abc/bang-tin");
    expect(sitePagePath("/xem/clans/9", "board", "p1")).toBe("/xem/clans/9/bang-tin/p1");
    expect(sitePagePath("/share/abc", "graves")).toBe("/share/abc/mo-phan");
  });

  it("nhận lại trang từ đường dẫn con; lạ thì null", () => {
    expect(sitePageFromSub("")).toBe("home");
    expect(sitePageFromSub("/bang-tin/p1")).toBe("board");
    expect(sitePageFromSub("su-kien")).toBe("events");
    expect(sitePageFromSub("khong-co")).toBeNull();
  });
});

describe("resolveSiteFlag", () => {
  it("?site=1 / ?site=0 thắng mọi thứ; sau đó tới giá trị nhớ trong phiên, cuối cùng là biến môi trường", () => {
    expect(resolveSiteFlag("?site=1", "0", undefined)).toBe(true);
    expect(resolveSiteFlag("?site=0", "1", "1")).toBe(false);
    expect(resolveSiteFlag("", "1", undefined)).toBe(true);
    expect(resolveSiteFlag("", "0", "1")).toBe(false);
    expect(resolveSiteFlag("", null, "1")).toBe(true);
  });

  it("mặc định TẮT (vẫn là màn Share cũ)", () => {
    expect(resolveSiteFlag("", null, undefined)).toBe(false);
    expect(resolveSiteFlag("?x=1", null, "0")).toBe(false);
  });
});

describe("isSiteScope", () => {
  it("link xem cây và link mời góp dùng được trang dòng họ; QR mộ / di sản / một người thì không", () => {
    expect(isSiteScope("tree_view")).toBe(true);
    expect(isSiteScope("contribute")).toBe(true);
    for (const s of ["single_person", "resting_place", "heritage_item", "", undefined]) expect(isSiteScope(s)).toBe(false);
  });
});
