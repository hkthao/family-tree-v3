import { describe, expect, it } from "vitest";

import { SCENE_IDS } from "@/components/timeline/TimelineScene";
import {
  libRef,
  normalizeImageUrl,
  parseImageRef,
} from "@/lib/timeline/images";
import { getMilestoneTemplates } from "@/lib/timeline/templates";

describe("link / hình của mốc", () => {
  it("chỉ nhận https, không dấu cách", () => {
    expect(normalizeImageUrl(" https://upload.wikimedia.org/a.jpg ")).toEqual({
      ok: true,
      url: "https://upload.wikimedia.org/a.jpg",
    });
    for (const bad of [
      "",
      "http://x.com/a.jpg",
      "javascript:alert(1)",
      "https://x.com/a b.jpg",
      "https://localhost/a.jpg",
      "ftp://x.com/a",
      "https://" + "a".repeat(600) + ".com",
    ]) {
      expect(normalizeImageUrl(bad).ok).toBe(false);
    }
  });

  it("parseImageRef: lib / url / giá trị hỏng", () => {
    expect(parseImageRef(libRef("tu-duong"))).toEqual({ kind: "lib", id: "tu-duong" });
    expect(parseImageRef("https://x.com/a.png")).toEqual({ kind: "url", url: "https://x.com/a.png" });
    expect(parseImageRef("lib:BAD ID")).toBeNull();
    expect(parseImageRef("http://x.com/a.png")).toBeNull();
    expect(parseImageRef(null)).toBeNull();
  });

  it("thư viện hình có đúng một cảnh cho mỗi mẫu mốc", () => {
    const ids = getMilestoneTemplates().map((x) => x.id).sort();
    expect([...SCENE_IDS].sort()).toEqual(ids);
  });
});
