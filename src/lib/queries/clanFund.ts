import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type FundDirection = "in" | "out";

export interface FundTransaction {
  id: string;
  clan_id: string;
  direction: FundDirection;
  amount: number;
  fund: string;
  category: string | null;
  occurred_on: string;
  note: string | null;
  created_at: string;
}

const COLS =
  "id, clan_id, direction, amount, fund, category, occurred_on, note, created_at";

export async function listFundTransactions(
  clanId: string,
  client: Client = defaultClient,
): Promise<FundTransaction[]> {
  const { data, error } = await client
    .from("fund_transactions")
    .select(COLS)
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...(r as FundTransaction),
    amount: Number(r.amount),
  }));
}

export type FundInput = {
  direction: FundDirection;
  amount: number;
  fund: string;
  category?: string | null;
  occurred_on?: string | null;
  note?: string | null;
};

export async function createFundTransaction(
  clanId: string,
  input: FundInput,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("fund_transactions").insert({
    clan_id: clanId,
    direction: input.direction,
    amount: input.amount,
    fund: input.fund,
    category: input.category ?? null,
    occurred_on: input.occurred_on ?? undefined, // để DB dùng current_date nếu trống
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Xoá mềm (deleted_at) — giữ dấu vết minh bạch. */
export async function deleteFundTransaction(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("fund_transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface FundSummary {
  totalIn: number;
  totalOut: number;
  balance: number;
  /** Số dư theo từng quỹ, sắp theo tên. */
  byFund: { fund: string; in: number; out: number; balance: number }[];
}

/** Tính tổng thu/chi/số dư (chung + theo từng quỹ) từ danh sách giao dịch. */
export function summarizeFund(txs: FundTransaction[]): FundSummary {
  let totalIn = 0;
  let totalOut = 0;
  const funds = new Map<string, { in: number; out: number }>();
  for (const t of txs) {
    const f = funds.get(t.fund) ?? { in: 0, out: 0 };
    if (t.direction === "in") {
      totalIn += t.amount;
      f.in += t.amount;
    } else {
      totalOut += t.amount;
      f.out += t.amount;
    }
    funds.set(t.fund, f);
  }
  const byFund = [...funds.entries()]
    .map(([fund, v]) => ({ fund, in: v.in, out: v.out, balance: v.in - v.out }))
    .sort((a, b) => a.fund.localeCompare(b.fund, "vi"));
  return { totalIn, totalOut, balance: totalIn - totalOut, byFund };
}
