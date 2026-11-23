import { describe, expect, it } from "vitest";

import { bioTimelineRows } from "@/lib/personTimeline";
import { DERIVE_TITLE, splitTitleBody } from "@/lib/timeline/titleBody";

describe("splitTitleBody", () => {
  it("ngắn: tiêu đề = nội dung, không có body", () => {
    expect(splitTitleBody("  Sinh ra ở Nam Định  ")).toEqual({ title: "Sinh ra ở Nam Định", body: null });
  });
  it("đúng 120 ký tự vẫn là tiêu đề; 121 thì cắt và giữ nguyên văn ở body", () => {
    const a = "x".repeat(DERIVE_TITLE);
    expect(splitTitleBody(a)).toEqual({ title: a, body: null });
    const b = "y".repeat(DERIVE_TITLE + 1);
    const r = splitTitleBody(b);
    expect(r.title).toHaveLength(DERIVE_TITLE - 2); // 117 ký tự + "…", giống migration và MCP
    expect(r.title.endsWith("…")).toBe(true);
    expect(r.body).toBe(b);
  });
});

describe("bioTimelineRows → mốc", () => {
  it("chỉ giữ các năm trong đời người và đọc đúng can chi / nội dung", () => {
    const bio = [
      "Sự nghiệp theo năm:",
      "- Năm Bính Tuất (1226): Lên ngôi vua",
      "- Năm Nhâm Dần (1242): Chia nước thành lộ",
      "- Năm Mậu Tý (1288): Sau khi mất",
    ].join("\n");
    const rows = bioTimelineRows(bio, 1218, 1277);
    expect(rows.map((r) => r.year)).toEqual([1226, 1242]);
    expect(rows[0]).toMatchObject({ era: "Bính Tuất", body: "Lên ngôi vua" });
  });
});

import { suggestIcon } from "@/lib/timeline/titleBody";

describe("suggestIcon — hình minh hoạ theo nội dung", () => {
  it.each([
    ["Sinh.", "cradle"],
    ["Sinh ngày 16 tháng 6.", "cradle"],
    ["Mất.", "candle"],
    ["Băng hà, thọ 59 tuổi", "candle"],
    ["Lên ngôi, ở ngôi đến năm 1258.", "citadel"],
    ["Đổi niên hiệu Kiến Trung.", "citadel"],
    ["Chống quân Nguyên Mông lần thứ nhất", "sword"],
    ["Kết hôn với bà Lê Thị A", "ring"],
    ["Mở khoa thi tiến sĩ", "book"],
    ["Việc gì đó không rõ", "scroll"],
  ])("%s → %s", (text, icon) => {
    expect(suggestIcon(text)).toBe(icon);
  });
});
