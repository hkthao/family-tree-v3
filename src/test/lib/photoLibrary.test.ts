import { describe, expect, it } from "vitest";

import { getEraCards } from "@/lib/timeline/eras";
import { normalizeImageUrl } from "@/lib/timeline/images";
import {
  creditText,
  findLibraryPhotoByUrl,
  LIBRARY_PHOTOS,
  libraryPhotoPage,
  libraryPhotoUrl,
  photosForEra,
} from "@/lib/timeline/photoLibrary";

describe("thư viện ảnh tư liệu (chỉ link)", () => {
  it("id không trùng, eraId thuộc thư viện thời đại, có ghi công", () => {
    const eras = new Set(getEraCards().map((e) => e.id));
    const ids = LIBRARY_PHOTOS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of LIBRARY_PHOTOS) {
      expect(eras.has(p.eraId)).toBe(true);
      expect(p.caption).toBeTruthy();
      expect(p.author).toBeTruthy();
      expect(p.license).toMatch(/^(Public domain|CC0|CC BY)/);
    }
  });

  it("link ảnh hợp lệ với quy tắc lưu của mốc (https, không dấu cách, ≤500 ký tự)", () => {
    for (const p of LIBRARY_PHOTOS) {
      const url = libraryPhotoUrl(p);
      expect(normalizeImageUrl(url).ok).toBe(true);
      expect(url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/")).toBe(true);
      expect(url).toContain("?width=800");
    }
  });

  it("nhận ra ảnh thư viện từ link đã lưu, không phân biệt cỡ; link lạ thì null", () => {
    const p = LIBRARY_PHOTOS[0];
    expect(findLibraryPhotoByUrl(libraryPhotoUrl(p))?.id).toBe(p.id);
    expect(findLibraryPhotoByUrl(libraryPhotoUrl(p, 1200))?.id).toBe(p.id);
    expect(findLibraryPhotoByUrl("https://example.com/a.jpg")).toBeNull();
    expect(findLibraryPhotoByUrl(null)).toBeNull();
  });

  it("photosForEra lọc đúng thời kỳ; trang mô tả và ghi công", () => {
    expect(photosForEra("ho").every((p) => p.eraId === "ho")).toBe(true);
    expect(photosForEra("ho").length).toBeGreaterThan(0);
    expect(photosForEra("khong-co")).toEqual([]);
    expect(libraryPhotoPage(LIBRARY_PHOTOS[0])).toContain("/wiki/File:");
    expect(creditText(LIBRARY_PHOTOS[0])).toContain("Wikimedia Commons");
  });
});
