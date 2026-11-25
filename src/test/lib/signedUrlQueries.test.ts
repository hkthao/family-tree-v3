import { describe, expect, it } from "vitest";

import {
  hasSignedUrls,
  queryClient,
  SIGNED_URL_STALE_MS,
} from "@/lib/queryClient";

/**
 * Truy vấn có URL ảnh ký 1 giờ (trang dòng họ, share-view) không được lưu bền / giữ lâu hơn hạn của URL,
 * nếu không mở lại sau >1 giờ là ảnh vỡ (InvalidJWT).
 */
describe("truy vấn có URL ký", () => {
  it("nhận ra khoá của trang dòng họ và share-view; không dính truy vấn khác", () => {
    expect(hasSignedUrls(["site", "tok", "mosaic"])).toBe(true);
    expect(hasSignedUrls(["share-view", "tok"])).toBe(true);
    expect(hasSignedUrls(["clan-detail", "c1"])).toBe(false);
    expect(hasSignedUrls([])).toBe(false);
  });
  it("hết hạn sau 30 phút (ngắn hơn hạn 1 giờ của URL) và nạp lại khi mở trang", () => {
    expect(SIGNED_URL_STALE_MS).toBeLessThan(60 * 60 * 1000);
    const d = queryClient.getQueryDefaults(["site", "tok", "mosaic"]);
    expect(d.staleTime).toBe(SIGNED_URL_STALE_MS);
    expect(d.refetchOnMount).toBe(true);
    expect(queryClient.getQueryDefaults(["share-view", "tok"]).staleTime).toBe(
      SIGNED_URL_STALE_MS,
    );
  });
});
