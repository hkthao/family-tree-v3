/**
 * Adapter Anthropic — dùng SDK chính thức (`npm:@anthropic-ai/sdk`).
 *
 * Khác adapter openai-compatible ở chỗ đây là một hãng cụ thể với một
 * SDK chính thức, nên dùng SDK thay vì fetch thô.
 *
 * Bốn khác biệt so với shape OpenAI, và đều là chỗ gateway hay vỡ:
 *
 *  1. `temperature` / `top_p` / `top_k` bị TỪ CHỐI (400) trên Opus 5,
 *     Sonnet 5. Shape nội bộ không có chúng nên không có gì để lọt ra —
 *     nhưng đừng ai thêm vào đây "cho tiện".
 *  2. `budget_tokens` đã bị bỏ. Độ sâu suy nghĩ chỉnh bằng
 *     `output_config.effort`.
 *  3. `max_tokens` tính CẢ phần thinking lẫn câu trả lời. Đặt chật là
 *     cụt câu giữa chừng, nên cộng thêm biên ở dưới.
 *  4. System prompt là tham số riêng, không phải message đầu tiên.
 *
 * Prompt caching: đánh dấu `cache_control` lên system + tool cuối cùng.
 * Đó là phần tĩnh lặp lại mỗi lượt, và theo phân tích chi phí thì cache
 * quan trọng hơn cả việc chọn model.
 */

import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";

import {
  LlmError,
  type LlmAdapter,
  type LlmRequest,
  type LlmResponse,
  type LlmToolCall,
  type ModelEntry,
} from "../types.ts";

/**
 * Thinking bật mặc định trên Opus 5 và ăn vào max_tokens, nên nới trần
 * ra để câu trả lời không bị cắt. Rẻ: chỉ trả tiền token thực sinh ra.
 */
const THINKING_HEADROOM = 4096;

/**
 * Dựng tham số gửi Anthropic. Tách ra vì bản có stream và bản không phải
 * gửi Y HỆT nhau — hai bản dựng riêng là chỗ chúng lệch dần: sửa cache
 * breakpoint ở một bên rồi quên bên kia, và chỉ lộ ra ở hoá đơn.
 */
function buildAnthropicParams(
  req: LlmRequest,
  model: ModelEntry,
): Anthropic.MessageCreateParamsNonStreaming {
  // Gộp các message tool liền nhau vào một lượt user — Anthropic yêu
  // cầu mọi tool_result của cùng một lượt nằm chung một message.
  const messages: Anthropic.MessageParam[] = [];
  for (const m of req.messages) {
    if (m.role === "system") continue; // đã đi qua tham số `system`
    if (m.role === "tool") {
      const block: Anthropic.ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: m.toolCallId ?? "",
        content: m.content,
      };
      const last = messages[messages.length - 1];
      if (last?.role === "user" && Array.isArray(last.content)) {
        (last.content as Anthropic.ContentBlockParam[]).push(block);
      } else {
        messages.push({ role: "user", content: [block] });
      }
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const t of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: t.id,
          name: t.name,
          input: t.arguments,
        });
      }
      messages.push({ role: "assistant", content: blocks });
      continue;
    }
    messages.push({ role: m.role as "user" | "assistant", content: m.content });
  }

  const tools: Anthropic.ToolUnion[] | undefined = req.tools?.map((t, i) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
    strict: t.parameters.additionalProperties === false,
    // Breakpoint cache ở tool cuối: tools render trước system nên đánh
    // dấu ở đây là cache được cả khối định nghĩa tool.
    ...(i === (req.tools?.length ?? 0) - 1
      ? { cache_control: { type: "ephemeral" as const } }
      : {}),
  }));

  return {
    model: model.rawId,
    max_tokens: req.maxTokens + THINKING_HEADROOM,
    system: [
      {
        type: "text",
        text: req.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
    ...(tools?.length ? { tools } : {}),
    thinking: { type: "adaptive" },
    output_config: { effort: req.effort ?? "medium" },
  } as Anthropic.MessageCreateParamsNonStreaming;
}

export const anthropicAdapter: LlmAdapter = {
  provider: "anthropic",

  async complete(
    req: LlmRequest,
    model: ModelEntry,
    apiKey: string,
  ): Promise<LlmResponse> {
    const client = new Anthropic({ apiKey });
    const params = buildAnthropicParams(req, model);

    let res: Anthropic.Message;
    try {
      res = await client.messages.create(params, { signal: req.signal });
    } catch (e) {
      throw toLlmError(e);
    }

    // Classifier có thể từ chối: HTTP 200 nhưng content rỗng. Phải kiểm
    // stop_reason TRƯỚC khi đọc content, nếu không là crash ở index [0].
    if (res.stop_reason === "refusal") {
      throw new LlmError(
        "Trợ lý từ chối yêu cầu này. Bạn thử hỏi cách khác nhé.",
        "bad_request",
      );
    }

    let text = "";
    const toolCalls: LlmToolCall[] = [];
    for (const block of res.content) {
      if (block.type === "text") text += block.text;
      else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        });
      }
      // thinking block: bỏ qua — mặc định không trả nội dung, và ta
      // cũng không hiển thị suy nghĩ cho người dùng.
    }

    return {
      text,
      toolCalls,
      usage: {
        inputTokens: res.usage.input_tokens ?? 0,
        outputTokens: res.usage.output_tokens ?? 0,
        cachedInputTokens: res.usage.cache_read_input_tokens ?? 0,
      },
      rawModel: res.model,
      stopReason: mapStopReason(res.stop_reason),
    };
  },

  /**
   * Bản có stream. Dùng `client.messages.stream()` của SDK chứ không tự
   * đọc SSE: SDK đã lo phần ghép sự kiện, gom `input_json_delta` của
   * tool, và trả về message hoàn chỉnh ở cuối — tự làm lại chỉ để chép
   * bug của người khác.
   */
  async completeStream(
    req: LlmRequest,
    model: ModelEntry,
    apiKey: string,
    onDelta: (text: string) => void,
  ): Promise<LlmResponse> {
    const client = new Anthropic({ apiKey });
    const params = buildAnthropicParams(req, model);

    let res: Anthropic.Message;
    try {
      const stream = client.messages.stream(params, { signal: req.signal });
      stream.on("text", (t: string) => onDelta(t));
      res = await stream.finalMessage();
    } catch (e) {
      throw toLlmError(e);
    }

    if (res.stop_reason === "refusal") {
      throw new LlmError(
        "Trợ lý từ chối yêu cầu này. Bạn thử hỏi cách khác nhé.",
        "bad_request",
      );
    }

    let text = "";
    const toolCalls: LlmToolCall[] = [];
    for (const block of res.content) {
      if (block.type === "text") text += block.text;
      else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    return {
      text,
      toolCalls,
      usage: {
        inputTokens: res.usage.input_tokens ?? 0,
        outputTokens: res.usage.output_tokens ?? 0,
        cachedInputTokens: res.usage.cache_read_input_tokens ?? 0,
      },
      rawModel: res.model,
      stopReason: mapStopReason(res.stop_reason),
    };
  },
};

function mapStopReason(r: string | null | undefined): LlmResponse["stopReason"] {
  return r === "tool_use"
    ? "tool_use"
    : r === "max_tokens"
      ? "max_tokens"
      : r === "end_turn"
        ? "end_turn"
        : "other";
}

/** Lỗi của SDK → LlmError, giữ nguyên cách phân loại của bản không stream. */
function toLlmError(e: unknown): LlmError {
  const anyErr = e as { status?: number; name?: string; message?: string };
  if (anyErr?.name === "AbortError") {
    return new LlmError("Quá thời gian chờ nhà cung cấp AI", "timeout");
  }
  const status = anyErr?.status;
  return new LlmError(
    `anthropic ${status ?? ""}: ${anyErr?.message ?? e}`.trim(),
    status === 401 || status === 403
      ? "auth"
      : status === 429
        ? "rate_limit"
        : status === 529
          ? "overloaded"
          : status && status >= 500
            ? "server"
            : status
              ? "bad_request"
              : "network",
    status,
  );
}
