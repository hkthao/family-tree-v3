/**
 * Danh mục model — MỘT chỗ duy nhất biết về giá và endpoint.
 *
 * Thêm nhà cung cấp mới nói OpenAI-compatible (Groq, Together,
 * OpenRouter, vLLM tự host…) = thêm một dòng vào đây, không viết code.
 * Đó là điểm khiến việc đổi provider rẻ.
 *
 * Giá tra ngày 23/8/2026 (xem docs/plan-ai-tro-ly.md §Chi phí). Thị
 * trường này đổi liên tục — DeepSeek đổi bảng giá 16/8/2026, OpenAI hạ
 * giá Luna/Terra tới 80% ngày 30/7/2026 — nên coi đây là số để ƯỚC TÍNH
 * chi phí nội bộ, không phải để tính tiền khách.
 */

import { env } from "./env.ts";
import type { ModelEntry } from "./types.ts";

const OPENAI = "https://api.openai.com/v1";
const DEEPSEEK = "https://api.deepseek.com/v1";

export const MODELS: Record<string, ModelEntry> = {
  // ─── OpenAI ──────────────────────────────────────────────────────
  // Luna là lựa chọn rẻ nhất hiện tại và KHÔNG có giá giờ cao điểm —
  // khác DeepSeek, vốn nhân đôi đúng khung giờ người Việt dùng app.
  // Lưu ý: $0,20/$1,20 là giá short-context; long-context nhảy lên
  // $0,40/$1,80. Prompt của ta ~6K token nên nằm trong short-context.
  "gpt-5.6-luna": {
    id: "gpt-5.6-luna",
    provider: "openai-compatible",
    rawId: "gpt-5.6-luna",
    baseUrl: OPENAI,
    apiKeyEnv: "OPENAI_API_KEY",
    priceIn: 0.2,
    priceCachedIn: 0.02,
    priceOut: 1.2,
    contextWindow: 400_000,
    supportsTools: true,
  },
  "gpt-5.6-terra": {
    id: "gpt-5.6-terra",
    provider: "openai-compatible",
    rawId: "gpt-5.6-terra",
    baseUrl: OPENAI,
    apiKeyEnv: "OPENAI_API_KEY",
    priceIn: 2,
    priceCachedIn: 0.2,
    priceOut: 12,
    contextWindow: 400_000,
    supportsTools: true,
  },

  // ─── DeepSeek (OpenAI-compatible — cùng adapter, khác baseUrl) ────
  // Giá dưới đây là GIỜ CAO ĐIỂM (01–04h và 06–10h UTC = 08–11h và
  // 13–17h giờ VN, tức đúng giờ người ta mở app). Ngoài khung đó rẻ
  // một nửa. Ghi giá peak để ước tính không bị lạc quan.
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    provider: "openai-compatible",
    rawId: "deepseek-v4-flash",
    baseUrl: DEEPSEEK,
    apiKeyEnv: "DEEPSEEK_API_KEY",
    priceIn: 0.44,
    priceCachedIn: 0.014,
    priceOut: 1.32,
    contextWindow: 128_000,
    supportsTools: true,
  },

  // ─── Anthropic (shape riêng → adapter riêng) ─────────────────────
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    provider: "anthropic",
    rawId: "claude-sonnet-5",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    priceIn: 3,
    priceCachedIn: 0.3,
    priceOut: 15,
    contextWindow: 1_000_000,
    supportsTools: true,
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    rawId: "claude-haiku-4-5",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    priceIn: 1,
    priceCachedIn: 0.1,
    priceOut: 5,
    contextWindow: 200_000,
    supportsTools: true,
  },
  "claude-opus-5": {
    id: "claude-opus-5",
    provider: "anthropic",
    rawId: "claude-opus-5",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    priceIn: 5,
    priceCachedIn: 0.5,
    priceOut: 25,
    contextWindow: 1_000_000,
    supportsTools: true,
  },
};

/** Model mặc định khi platform_settings chưa cấu hình gì. */
export const DEFAULT_MODELS = {
  qa: "gpt-5.6-luna",
  extract: "gpt-5.6-luna",
} as const;

export function getModel(id: string): ModelEntry {
  const m = MODELS[id];
  if (!m) throw new Error(`Model không có trong registry: ${id}`);
  return m;
}

/**
 * Chỉ trả về model mà môi trường hiện tại có khoá. Dùng để chọn dự
 * phòng — không có ý nghĩa gì khi cấu hình một model mà chưa cắm khoá.
 */
export function availableModels(): ModelEntry[] {
  return Object.values(MODELS).filter((m) => !!env(m.apiKeyEnv));
}

/** USD ước tính cho một lượt gọi. */
export function estimateCost(
  m: ModelEntry,
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number },
): number {
  const fresh = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (fresh * m.priceIn +
      usage.cachedInputTokens * m.priceCachedIn +
      usage.outputTokens * m.priceOut) /
    1_000_000
  );
}
