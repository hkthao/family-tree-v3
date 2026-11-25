import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { contributeUrl, questionUrl, shareLinkPath, shareLinkUrl, shareTokenPath } from "@/lib/shareUrls";
import { focusPageOf, isShellScope, isSiteScope } from "@/lib/siteSections";

const O = "https://app.example";

describe("shareLinkPath: mỗi loại link dẫn vào đúng mục menu", () => {
  it("QR người → hồ sơ; QR mộ → Mộ phần; QR di sản → Di sản; mời góp → Cùng góp; cây → trang chủ", () => {
    expect(shareLinkPath({ token: "t", scope: "single_person", root_person_id: "p1" })).toBe("/share/t/nguoi/p1");
    expect(shareLinkPath({ token: "t", scope: "resting_place", root_resting_place_id: "g1" })).toBe("/share/t/mo-phan/g1");
    expect(shareLinkPath({ token: "t", scope: "heritage_item", root_heritage_item_id: "h1" })).toBe("/share/t/di-san/h1");
    expect(shareLinkPath({ token: "t", scope: "contribute" })).toBe("/share/t/cung-gop");
    expect(shareLinkPath({ token: "t", scope: "tree_view" })).toBe("/s/t");
  });

  it("thiếu id gốc thì về trang chủ của link (không tạo đường dẫn hỏng)", () => {
    expect(shareLinkPath({ token: "t", scope: "single_person" })).toBe("/share/t");
    expect(shareLinkPath({ token: "t", scope: "lạ" })).toBe("/s/t");
  });

  it("url đầy đủ bỏ dấu / thừa ở gốc; link mời góp và câu hỏi giữ tab=gop cho màn cũ", () => {
    expect(shareLinkUrl(`${O}/`, { token: "t", scope: "tree_view" })).toBe(`${O}/s/t`);
    expect(contributeUrl(O, "t")).toBe(`${O}/share/t/cung-gop?tab=gop`);
    expect(contributeUrl(O, "t", "p1")).toBe(`${O}/share/t/cung-gop?tab=gop&p=p1`);
    expect(questionUrl(O, "t", "q1")).toBe(`${O}/share/t/cung-gop?tab=gop&q=q1`);
    expect(shareTokenPath("t", "board", "x")).toBe("/share/t/bang-tin/x");
  });
});

describe("scope tập trung", () => {
  it("ba loại QR mở trong khung nhưng không phải trang đầy đủ", () => {
    expect(focusPageOf("single_person")).toBe("person");
    expect(focusPageOf("resting_place")).toBe("graves");
    expect(focusPageOf("heritage_item")).toBe("heritage");
    expect(focusPageOf("tree_view")).toBeNull();
    for (const s of ["single_person", "resting_place", "heritage_item", "tree_view", "contribute"]) expect(isShellScope(s)).toBe(true);
    expect(isSiteScope("single_person")).toBe(false);
    expect(isShellScope("lạ")).toBe(false);
  });
});

/** Dễ bảo trì: không chỗ nào ngoài shareUrls.ts / siteSections.ts / trang dòng họ được tự ghép `/share/<token>`. */
describe("shareUrlsGuard", () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? (f === "test" || f === "locales" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
  it("không ghép chuỗi /share/${…} ngoài các file cho phép", () => {
    const allowed = ["lib/shareUrls.ts", "pages/site/ClanSiteRoot.tsx"];
    const bad = walk(join(process.cwd(), "src")).filter((f) => !allowed.some((a) => f.endsWith(a)) && /\/share\/\$\{/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
