import { describe, expect, it } from "vitest";

import {
  bulletsToText,
  contextToColumns,
  defaultContext,
  resolveContext,
  textToBullets,
} from "@/lib/timeline/context";

describe("bối cảnh thời đại của mốc", () => {
  it("mặc định theo năm: 1975 ra 'Đất nước chia hai miền'", () => {
    const d = defaultContext(1975)!;
    expect(d.title).toBe("Đất nước chia hai miền");
    expect(d.bullets.length).toBeGreaterThan(0);
  });
  it("năm không hợp lệ không có mặc định", () => {
    expect(defaultContext(0)).toBeNull();
    expect(defaultContext(NaN)).toBeNull();
  });

  it("textToBullets: mỗi dòng một ý, bỏ dòng trống và gạch đầu dòng, giới hạn", () => {
    expect(textToBullets("- Một\n\n  Hai  \n• Ba\n*Bốn")).toEqual(["Một", "Hai", "Ba", "Bốn"]);
    expect(textToBullets(Array.from({ length: 10 }, (_, i) => `ý ${i}`).join("\n"))).toHaveLength(6);
    expect(textToBullets("x".repeat(500))[0]).toHaveLength(160);
  });

  it("resolveContext: null/null = mặc định; ''/'' = ẩn; còn lại = tự sửa", () => {
    expect(resolveContext(1975, null, null)?.title).toBe("Đất nước chia hai miền");
    expect(resolveContext(1975, "", "")).toBeNull();
    const c = resolveContext(1975, "Năm cả nhà về quê", "Đường xa\nMưa nhiều");
    expect(c?.title).toBe("Năm cả nhà về quê");
    expect(c?.bullets).toEqual(["Đường xa", "Mưa nhiều"]);
    expect(c?.iconKey).toBeTruthy();
  });

  it("contextToColumns: giữ nguyên mặc định thì lưu null (tiếp tục theo thời đại)", () => {
    const d = defaultContext(1975)!;
    expect(contextToColumns(1975, d.title, bulletsToText(d.bullets))).toEqual({
      context_title: null,
      context_body: null,
    });
  });
  it("contextToColumns: xoá trống hết thì ẩn; sửa thì lưu bản tự sửa", () => {
    expect(contextToColumns(1975, "  ", " \n ")).toEqual({ context_title: "", context_body: "" });
    expect(contextToColumns(1975, "Tên khác", "A\nB")).toEqual({
      context_title: "Tên khác",
      context_body: "A\nB",
    });
  });
  it("năm đổi sang thời đại khác thì nội dung cũ không còn là mặc định → được giữ như bản tự sửa", () => {
    const d1975 = defaultContext(1975)!;
    expect(contextToColumns(1990, d1975.title, bulletsToText(d1975.bullets)).context_title).toBe(d1975.title);
  });
});
