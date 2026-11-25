import { describe, expect, it } from "vitest";

import { sitePartUrl } from "@/lib/queries/site-parts";

describe("sitePartUrl", () => {
  it("link token dùng ?token=, dòng họ công khai dùng ?clan=", () => {
    expect(sitePartUrl("http://x", { token: "t1" }, "posts")).toBe("http://x/functions/v1/share-view?token=t1&part=posts");
    expect(sitePartUrl("http://x", { clanId: "c1" }, "posts")).toBe("http://x/functions/v1/share-view?clan=c1&part=posts");
  });

  it("bỏ tham số rỗng / undefined, giữ số 0 không bị nuốt, mã hoá giá trị", () => {
    const u = sitePartUrl("http://x", { token: "t" }, "posts", { page: 2, per: 9, type: undefined, q: "", z: "a b&c" });
    expect(u).toContain("page=2");
    expect(u).toContain("per=9");
    expect(u).not.toContain("type=");
    expect(u).not.toContain("q=");
    expect(u).toContain("z=a+b%26c");
  });
});
