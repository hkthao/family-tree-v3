import { describe, expect, it } from "vitest";

import { summarizeFund, type FundTransaction } from "@/lib/queries/clanFund";

function tx(p: Partial<FundTransaction>): FundTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    clan_id: "c",
    direction: "in",
    amount: 0,
    fund: "Quỹ chung",
    category: null,
    occurred_on: "2026-01-01",
    note: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

describe("summarizeFund", () => {
  it("số dư 0 khi rỗng", () => {
    expect(summarizeFund([])).toEqual({
      totalIn: 0,
      totalOut: 0,
      balance: 0,
      byFund: [],
    });
  });

  it("cộng thu, trừ chi cho số dư", () => {
    const s = summarizeFund([
      tx({ direction: "in", amount: 1_000_000 }),
      tx({ direction: "in", amount: 500_000 }),
      tx({ direction: "out", amount: 300_000 }),
    ]);
    expect(s.totalIn).toBe(1_500_000);
    expect(s.totalOut).toBe(300_000);
    expect(s.balance).toBe(1_200_000);
  });

  it("tách số dư theo từng quỹ, sắp theo tên", () => {
    const s = summarizeFund([
      tx({ fund: "Khuyến học", direction: "in", amount: 800_000 }),
      tx({ fund: "Khuyến học", direction: "out", amount: 200_000 }),
      tx({ fund: "Quỹ chung", direction: "in", amount: 1_000_000 }),
    ]);
    expect(s.byFund.map((f) => f.fund)).toEqual(["Khuyến học", "Quỹ chung"]);
    const kh = s.byFund.find((f) => f.fund === "Khuyến học")!;
    expect(kh).toMatchObject({ in: 800_000, out: 200_000, balance: 600_000 });
    expect(s.balance).toBe(1_600_000);
  });

  it("số dư âm khi chi > thu", () => {
    const s = summarizeFund([
      tx({ direction: "in", amount: 100_000 }),
      tx({ direction: "out", amount: 250_000 }),
    ]);
    expect(s.balance).toBe(-150_000);
  });
});
