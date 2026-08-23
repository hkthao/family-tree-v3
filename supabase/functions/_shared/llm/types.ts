/**
 * Shape nội bộ của gateway LLM — cố tình KHÔNG giống provider nào.
 *
 * Nguyên tắc quan trọng nhất ở file này: **không có `temperature`,
 * `top_p`, `top_k`**. Claude Opus 5 / Sonnet 5 từ chối các tham số đó
 * bằng lỗi 400, mà gateway đa provider nào cũng có thói quen forward
 * `temperature: 0.2` cho tất cả — đó là cách nhanh nhất để vỡ.
 *
 * Muốn điều chỉnh độ "sáng tạo" thì viết vào prompt, đừng thêm tham số
 * vào đây. Adapter nào cần giá trị mặc định của riêng nó thì tự đặt bên
 * trong adapter, không phơi ra shape chung.
 *
 * Xem docs/plan-ai-tro-ly.md §Quyết định kiến trúc.
 */

export type Role = "system" | "user" | "assistant" | "tool";

/** Một tin nhắn trong hội thoại, đã chuẩn hoá khỏi mọi provider. */
export interface LlmMessage {
  role: Role;
  content: string;
  /** Chỉ có ở role="assistant" khi model muốn gọi tool. */
  toolCalls?: LlmToolCall[];
  /** Chỉ có ở role="tool" — id của lời gọi mà tin này trả lời. */
  toolCallId?: string;
  /** Chỉ có ở role="tool" — tên tool, một số provider bắt buộc. */
  toolName?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  /** Đã parse sẵn. Adapter chịu trách nhiệm JSON.parse an toàn. */
  arguments: Record<string, unknown>;
}

/** Định nghĩa tool. `parameters` là JSON Schema thuần. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface LlmRequest {
  /** Id trong registry, KHÔNG phải id thô của provider. */
  model: string;
  system: string;
  messages: LlmMessage[];
  tools?: ToolSpec[];
  /**
   * Trần token đầu ra. Với Claude đời mới con số này bao gồm CẢ phần
   * thinking lẫn câu trả lời — đặt chật là cụt câu giữa chừng.
   */
  maxTokens: number;
  /**
   * Độ "cố gắng". Anthropic map sang `output_config.effort`; các
   * provider khác hiện bỏ qua. Không phải `temperature`.
   */
  effort?: "low" | "medium" | "high";
  /** Huỷ khi quá hạn. Mặc định đặt ở gateway. */
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** Token đọc từ cache — rẻ hơn nhiều, tách ra để tính tiền cho đúng. */
  cachedInputTokens: number;
}

export interface LlmResponse {
  /** Rỗng khi model chỉ gọi tool mà không nói gì. */
  text: string;
  toolCalls: LlmToolCall[];
  usage: LlmUsage;
  /** Id thô của provider — ghi vào ai_usage để truy vết. */
  rawModel: string;
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";
}

/**
 * Adapter chỉ cần làm đúng một việc: dịch LlmRequest sang API của
 * provider rồi dịch ngược kết quả về LlmResponse.
 */
export interface LlmAdapter {
  readonly provider: string;
  complete(req: LlmRequest, model: ModelEntry): Promise<LlmResponse>;
}

export interface ModelEntry {
  /** Id dùng trong app và trong platform_settings. */
  id: string;
  provider: "openai-compatible" | "anthropic";
  /** Id thật gửi lên provider. */
  rawId: string;
  /** Chỉ với openai-compatible: endpoint gốc. */
  baseUrl?: string;
  /** Tên biến môi trường chứa khoá. Khoá KHÔNG bao giờ nằm trong code. */
  apiKeyEnv: string;
  /** USD trên 1 triệu token — chỉ để ước tính chi phí, không để tính tiền khách. */
  priceIn: number;
  priceOut: number;
  priceCachedIn: number;
  contextWindow: number;
  supportsTools: boolean;
}

/** Lỗi có phân loại, để gateway biết cái nào đáng retry. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "auth"
      | "rate_limit"
      | "overloaded"
      | "bad_request"
      | "timeout"
      | "network"
      | "server",
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }

  /** 429/5xx/mạng là tạm thời; 400/401 thì retry chỉ tốn tiền. */
  get retryable(): boolean {
    return (
      this.kind === "rate_limit" ||
      this.kind === "overloaded" ||
      this.kind === "server" ||
      this.kind === "network" ||
      this.kind === "timeout"
    );
  }
}
