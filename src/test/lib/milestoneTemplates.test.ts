import { describe, expect, it } from "vitest";

import { TIMELINE_ICON_KEYS } from "@/components/timeline/TimelineIcon";
import { getMilestoneTemplates } from "@/lib/timeline/templates";

describe("mẫu mốc dòng thời gian", () => {
  const all = getMilestoneTemplates();
  it("id không trùng", () => {
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
  });
  it("mỗi mẫu có tiêu đề, mô tả hợp lệ (≤200 / ≤2000) và hình có trong bộ icon", () => {
    for (const x of all) {
      expect(x.title.length).toBeGreaterThan(0);
      expect(x.title.length).toBeLessThanOrEqual(200);
      expect(x.body.length).toBeLessThanOrEqual(2000);
      expect(TIMELINE_ICON_KEYS).toContain(x.iconKey);
    }
  });
});
