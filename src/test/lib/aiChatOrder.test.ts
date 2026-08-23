import { describe, expect, it } from "vitest";

import { orderTurns } from "@/lib/queries/aiChat";

/**
 * Lỗi thật: khung chat hiện câu trả lời NẰM TRÊN câu hỏi.
 *
 * Nguyên nhân: hai dòng được chèn trong cùng một câu lệnh nên
 * `default now()` cho ra timestamp y hệt nhau — sắp theo created_at bị
 * hoà, thứ tự trả về tuỳ hứng.
 */
describe("orderTurns", () => {
  const at = (s: string) => `2026-08-23T10:00:0${s}.000Z`;

  it("hoà thời gian thì câu hỏi đứng trước câu trả lời", () => {
    const rows = [
      { role: "assistant", content: "Giỗ ngày 5/9", created_at: at("0") },
      { role: "user", content: "Giỗ sắp tới là ngày nào?", created_at: at("0") },
    ];
    expect(orderTurns(rows).map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("khác thời gian thì theo đúng thời gian, kể cả khi dữ liệu về đảo", () => {
    const rows = [
      { role: "user", content: "câu 2", created_at: at("9") },
      { role: "assistant", content: "đáp 1", created_at: at("2") },
      { role: "user", content: "câu 1", created_at: at("1") },
    ];
    expect(orderTurns(rows).map((t) => t.content)).toEqual([
      "câu 1",
      "đáp 1",
      "câu 2",
    ]);
  });

  it("không sửa mảng gốc", () => {
    const rows = [
      { role: "assistant", content: "b", created_at: at("2") },
      { role: "user", content: "a", created_at: at("1") },
    ];
    orderTurns(rows);
    expect(rows[0].content).toBe("b");
  });
});
