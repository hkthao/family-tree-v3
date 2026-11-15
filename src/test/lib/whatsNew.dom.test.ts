/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  NEW_FEATURES,
  __resetNewSeen,
  featurePathOf,
  hasUnreadChangelog,
  isNewFeaturePath,
  markNewSeen,
} from "@/lib/whatsNew";

const f = NEW_FEATURES[0];
const day = (iso: string, plus = 0) =>
  new Date(new Date(iso + "T00:00:00").getTime() + plus * 86_400_000);

describe("whatsNew", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetNewSeen();
  });

  it("featurePathOf lấy đoạn sau /clans/:id/", () => {
    expect(featurePathOf("/clans/abc/mosaics/xyz")).toBe("mosaics");
    expect(featurePathOf("/clans/abc")).toBeNull();
    expect(featurePathOf("/docs")).toBeNull();
  });

  it("hiện Mới trong cửa sổ 30 ngày, hết hạn thì ẩn", () => {
    expect(isNewFeaturePath(f.path, day(f.since, 5))).toBe(true);
    expect(isNewFeaturePath(f.path, day(f.since, 31))).toBe(false);
    expect(isNewFeaturePath(f.path, day(f.since, -1))).toBe(false);
  });

  it("không hiện cho trang không có trong danh sách", () => {
    expect(isNewFeaturePath("people", day(f.since, 1))).toBe(false);
    expect(isNewFeaturePath(null, day(f.since, 1))).toBe(false);
  });

  it("mở trang rồi thì không hiện nữa và nhớ qua lần tải sau", () => {
    expect(isNewFeaturePath(f.path, day(f.since, 1))).toBe(true);
    markNewSeen(f.path);
    expect(isNewFeaturePath(f.path, day(f.since, 1))).toBe(false);
    __resetNewSeen();
    expect(isNewFeaturePath(f.path, day(f.since, 1))).toBe(false);
  });

  it("changelog: chưa xem lần nào mà có tin → chưa đọc; tin cũ hơn lần xem → đã đọc", () => {
    expect(hasUnreadChangelog("2026-11-10T00:00:00Z", "")).toBe(true);
    expect(
      hasUnreadChangelog("2026-11-10T00:00:00Z", "2026-11-10T00:00:00Z"),
    ).toBe(false);
    expect(
      hasUnreadChangelog("2026-11-12T00:00:00Z", "2026-11-10T00:00:00Z"),
    ).toBe(true);
    expect(hasUnreadChangelog(null, "")).toBe(false);
  });
});
