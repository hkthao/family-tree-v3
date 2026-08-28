import { describe, expect, it } from "vitest";

import { runningBalances, type CreditEntry } from "@/lib/queries/credits";

const entry = (delta: number, at: string): CreditEntry => ({
  id: at,
  resource: "ai_request",
  delta,
  reason: delta > 0 ? "monthly_free" : "consume",
  expires_at: null,
  at,
});

describe("runningBalances", () => {
  it("cộng dồn từ bút toán CŨ NHẤT, trả về theo đúng thứ tự mới→cũ", () => {
    // Sổ hiện mới nhất trước, nhưng số dư thì cộng từ dưới lên. Đảo nhầm
    // chiều là dòng đầu tiên hiện số dư của ngày xa nhất.
    const rows = [
      entry(-1, "2026-08-03"),
      entry(-1, "2026-08-02"),
      entry(10, "2026-08-01"),
    ];
    expect(runningBalances(rows)).toEqual([8, 9, 10]);
  });

  it("sổ trống thì không có số dư nào", () => {
    expect(runningBalances([])).toEqual([]);
  });

  it("hoàn lại làm số dư tăng lại đúng chỗ", () => {
    const rows = [
      entry(1, "2026-08-04"), // hoàn do lỗi
      entry(-1, "2026-08-03"),
      entry(10, "2026-08-01"),
    ];
    expect(runningBalances(rows)).toEqual([10, 9, 10]);
  });
});
