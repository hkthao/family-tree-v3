/**
 * Gateway — chọn adapter theo model, đặt timeout, retry, và trả về kết
 * quả đã chuẩn hoá kèm chi phí ước tính.
 *
 * Gọi qua đây, đừng gọi adapter trực tiếp: timeout và retry nằm ở đây.
 */

import { anthropicAdapter } from "./adapters/anthropic.ts";
import { openAiCompatibleAdapter } from "./adapters/openai-compatible.ts";
import { estimateCost, getModel } from "./registry.ts";
import {
  LlmError,
  type LlmAdapter,
  type LlmRequest,
  type LlmResponse,
} from "./types.ts";

const ADAPTERS: Record<string, LlmAdapter> = {
  "openai-compatible": openAiCompatibleAdapter,
  anthropic: anthropicAdapter,
};

/** Người dùng đang ngồi chờ — quá 60s thì thà báo lỗi còn hơn treo. */
const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

export interface CompleteResult extends LlmResponse {
  modelId: string;
  /** USD ước tính, chỉ để ghi ai_usage. */
  costUsd: number;
  attempts: number;
  latencyMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function complete(
  req: Omit<LlmRequest, "signal">,
  apiKey: string,
): Promise<CompleteResult> {
  const model = getModel(req.model);
  const adapter = ADAPTERS[model.provider];
  if (!adapter) throw new Error(`Không có adapter cho ${model.provider}`);

  const started = Date.now();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await adapter.complete(
        { ...req, signal: ac.signal },
        model,
        apiKey,
      );
      return {
        ...res,
        modelId: model.id,
        costUsd: estimateCost(model, res.usage),
        attempts: attempt,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      lastErr = e;
      const retryable = e instanceof LlmError && e.retryable;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      // Backoff có jitter — nhiều người cùng bị 429 thì đừng thử lại
      // cùng một nhịp.
      await sleep(400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr;
}

/**
 * Đổi lỗi kỹ thuật thành câu tiếng Việt cho người lớn tuổi đọc: nói
 * được chuyện gì xảy ra và nên làm gì, không có mã lỗi, không xin lỗi
 * dài dòng.
 */
export function friendlyLlmError(e: unknown): string {
  if (e instanceof LlmError) {
    switch (e.kind) {
      case "rate_limit":
        return "Trợ lý đang bận. Bạn đợi một chút rồi hỏi lại nhé.";
      case "overloaded":
      case "server":
        return "Trợ lý đang gặp trục trặc. Bạn thử lại sau ít phút.";
      case "timeout":
        return "Trợ lý trả lời lâu quá. Bạn thử hỏi lại câu ngắn hơn.";
      case "auth":
        return "Trợ lý chưa được cấu hình. Vui lòng báo quản trị viên.";
      case "network":
        return "Không kết nối được tới trợ lý. Kiểm tra mạng giúp nhé.";
      default:
        return e.message;
    }
  }
  return "Trợ lý gặp lỗi không rõ. Bạn thử lại nhé.";
}
