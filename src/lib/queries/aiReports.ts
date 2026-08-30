import { supabase } from "../supabase";

/**
 * Báo cáo sử dụng trợ lý AI — chỉ platform admin đọc được.
 *
 * Cộng ở Postgres chứ không kéo hết `ai_usage` về trình duyệt rồi SUM:
 * một tháng vài nghìn dòng là tốn băng thông vô ích, mà lại chậm đúng
 * lúc admin cần nhìn nhanh.
 *
 * Mọi hàm ở đây ném lỗi khi người gọi không phải admin (hàm SQL tự kiểm
 * quyền, không chỉ dựa vào GRANT) — màn hình bắt lỗi đó và nói rõ, thay
 * vì hiện "0 lượt" làm người xem tưởng không ai dùng.
 */

export interface AiUsageOverview {
  days: number;
  requests: number;
  users: number;
  clans: number;
  failed: number;
  extracts: number;
  input_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
  /** Tỉ lệ token đầu vào đọc từ cache. Tụt = prompt caching hỏng. */
  cached_ratio: number;
}

export interface AiUsageDay {
  day: string;
  requests: number;
  failed: number;
  cost_usd: number;
}

export interface AiUsageByModel {
  model_id: string;
  requests: number;
  cost_usd: number;
  avg_latency_ms: number;
  cached_ratio: number;
}

export interface AiUsageByClan {
  clan_id: string | null;
  clan_name: string;
  requests: number;
  users: number;
  cost_usd: number;
}

export interface CreditOverview {
  granted: number;
  consumed: number;
  refunded: number;
  wallets: number;
  /** Số người đang hết lượt — con số trả lời "10 lượt/tháng có chật không". */
  exhausted: number;
}

const num = (v: unknown): number => Number(v ?? 0);

export async function getAiUsageOverview(days: number): Promise<AiUsageOverview> {
  const { data, error } = await supabase.rpc("ai_usage_overview", {
    p_days: days,
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as Record<string, unknown>;
  return {
    days: num(r.days),
    requests: num(r.requests),
    users: num(r.users),
    clans: num(r.clans),
    failed: num(r.failed),
    extracts: num(r.extracts),
    input_tokens: num(r.input_tokens),
    cached_tokens: num(r.cached_tokens),
    output_tokens: num(r.output_tokens),
    cost_usd: num(r.cost_usd),
    avg_latency_ms: num(r.avg_latency_ms),
    cached_ratio: num(r.cached_ratio),
  };
}

export async function getAiUsageDaily(days: number): Promise<AiUsageDay[]> {
  const { data, error } = await supabase.rpc("ai_usage_daily", { p_days: days });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    day: String(d.day),
    requests: num(d.requests),
    failed: num(d.failed),
    cost_usd: num(d.cost_usd),
  }));
}

export async function getAiUsageByModel(days: number): Promise<AiUsageByModel[]> {
  const { data, error } = await supabase.rpc("ai_usage_by_model", {
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    model_id: String(d.model_id),
    requests: num(d.requests),
    cost_usd: num(d.cost_usd),
    avg_latency_ms: num(d.avg_latency_ms),
    cached_ratio: num(d.cached_ratio),
  }));
}

export async function getAiUsageByClan(days: number): Promise<AiUsageByClan[]> {
  const { data, error } = await supabase.rpc("ai_usage_by_clan", {
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    clan_id: d.clan_id ? String(d.clan_id) : null,
    clan_name: String(d.clan_name),
    requests: num(d.requests),
    users: num(d.users),
    cost_usd: num(d.cost_usd),
  }));
}

export async function getCreditOverview(): Promise<CreditOverview> {
  const { data, error } = await supabase.rpc("credit_overview");
  if (error) throw new Error(error.message);
  const r = data as unknown as Record<string, unknown>;
  return {
    granted: num(r.granted),
    consumed: num(r.consumed),
    refunded: num(r.refunded),
    wallets: num(r.wallets),
    exhausted: num(r.exhausted),
  };
}

/** Tiền theo tỉ giá tham chiếu, để admin khỏi phải nhẩm. */
export const USD_TO_VND = 26_000;

export function formatUsd(v: number): string {
  // Chi phí mỗi lượt cỡ vài phần nghìn đô — làm tròn 2 số là ra "$0.00"
  // cho mọi thứ, nhìn như chưa tốn gì.
  return v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

export function formatVnd(usd: number): string {
  return `${Math.round(usd * USD_TO_VND).toLocaleString("vi-VN")}đ`;
}

/** 1234567 → "1,23 tr" — token đếm bằng triệu, in đủ số thì không đọc nổi. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}
