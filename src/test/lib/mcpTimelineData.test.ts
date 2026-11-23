import { describe, expect, it } from "vitest";

import { SCENES } from "@/components/timeline/TimelineScene";
import { getEraCards } from "@/lib/timeline/eras";
import { getMilestoneTemplates } from "@/lib/timeline/templates";
import { eraOfYear, SCENE_IDS, TIMELINE_ERAS, TIMELINE_SCENES, TIMELINE_TEMPLATES } from "../../../mcp-server/src/timelineData";

// mcp-server/src/timelineData.ts được SINH từ code của app — lệch thì phải sinh lại.
describe("dữ liệu dòng thời gian của MCP khớp với app", () => {
  it("thời đại (bối cảnh): cùng id, năm, tiêu đề, các ý, icon", () => {
    expect(TIMELINE_ERAS).toEqual(
      getEraCards().map((e) => ({ id: e.id, from: e.from, to: e.to, title: e.title, bullets: e.bullets, icon: e.iconKey })),
    );
  });
  it("cảnh minh hoạ: cùng id và icon", () => {
    expect(TIMELINE_SCENES).toEqual(Object.entries(SCENES).map(([id, s]) => ({ id, icon: s.icon })));
    expect(SCENE_IDS).toEqual(Object.keys(SCENES));
  });
  it("mẫu mốc: cùng nội dung", () => {
    expect(TIMELINE_TEMPLATES).toEqual(getMilestoneTemplates().map((x) => ({ id: x.id, title: x.title, body: x.body, icon: x.iconKey })));
  });
  it("eraOfYear lấy ĐÚNG thời đại chứa năm", () => {
    expect(eraOfYear(1225)?.title).toBe("Nhà Lý");
    expect(eraOfYear(1230)?.title).toBe("Nhà Trần");
    expect(eraOfYear(1975)?.title).toBe("Đất nước chia hai miền");
    expect(eraOfYear(900)).toBeNull();
  });
});
