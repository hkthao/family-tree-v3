/**
 * Adapter cho MỌI endpoint nói giọng OpenAI: OpenAI, DeepSeek, Groq,
 * Together, OpenRouter, và vLLM tự host về sau.
 *
 * Dùng fetch thẳng thay vì SDK của OpenAI là có chủ ý: adapter này phải
 * phục vụ endpoint bất kỳ, nên phụ thuộc vào SDK của một hãng cụ thể là
 * đi ngược mục đích. Bề mặt `/chat/completions` cũng đủ ổn định.
 *
 * KHÔNG gửi `temperature` / `top_p`. Xem lý do ở types.ts.
 */

import {
  LlmError,
  type LlmAdapter,
  type LlmRequest,
  type LlmResponse,
  type LlmToolCall,
  type ModelEntry,
  type ToolSpec,
} from "../types.ts";

interface OaiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OaiChoice {
  message: {
    content: string | null;
    tool_calls?: OaiToolCall[];
  };
  finish_reason: string;
}

interface OaiResponse {
  model: string;
  choices: OaiChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

/**
 * Model đôi khi trả `arguments` không phải JSON hợp lệ (hay gặp ở model
 * nhỏ). Không được để cả lượt chết vì một tool call hỏng — trả object
 * rỗng và để tầng trên xử lý bằng zod.
 */
function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function mapStop(reason: string): LlmResponse["stopReason"] {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "other";
  }
}

/**
 * Có bật được `strict` cho schema này không?
 *
 * OpenAI đòi HAI điều, không phải một: `additionalProperties: false` **và**
 * `required` phải liệt kê ĐỦ mọi key trong `properties`. Thiếu một key là
 * 400 ngay từ lúc gửi:
 *
 *   Invalid schema for function 'upcoming_anniversaries': 'required' is
 *   required to be supplied and to be an array including every key in
 *   properties. Missing 'days'.
 *
 * Trước đây chỉ kiểm điều thứ nhất, nên tool nào có tham số **tuỳ chọn**
 * là làm hỏng cả lượt chat — không phải hỏng riêng tool đó, vì danh sách
 * tool đi kèm mọi request.
 *
 * Không "sửa" bằng cách nhét hết key vào `required`: tham số tuỳ chọn là
 * tuỳ chọn thật (`days` mặc định 60). Ép model luôn phải điền thì nó sẽ
 * bịa số. Thà bỏ `strict` cho riêng tool đó — đằng nào tầng trên cũng
 * validate lại bằng zod trước khi chạy.
 */
function isStrictSafe(p: ToolSpec["parameters"]): boolean {
  if (p.additionalProperties !== false) return false;
  const required = new Set(p.required ?? []);
  return Object.keys(p.properties ?? {}).every((k) => required.has(k));
}

/**
 * Dựng body cho `/chat/completions`. Tách thành hàm THUẦN để unit test
 * được — đây là chỗ mọi khác biệt provider bị chặn lại, nên nó cần test
 * chứ không chỉ cần chạy.
 */
export function buildOpenAiBody(
  req: LlmRequest,
  model: ModelEntry,
): Record<string, unknown> {
  // System đi thành message đầu tiên — đó là quy ước của shape này.
  const messages: unknown[] = [{ role: "system", content: req.system }];
  for (const m of req.messages) {
    if (m.role === "tool") {
      messages.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      messages.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((t) => ({
          id: t.id,
          type: "function",
          function: { name: t.name, arguments: JSON.stringify(t.arguments) },
        })),
      });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const body: Record<string, unknown> = {
    model: model.rawId,
    messages,
    max_completion_tokens: req.maxTokens,
  };

  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        strict: isStrictSafe(t.parameters),
      },
    }));
    body.tool_choice = "auto";
    // Xem ModelEntry.toolsNeedReasoningNone — model suy luận của OpenAI
    // từ chối tool trên /chat/completions nếu không tắt suy luận.
    if (model.toolsNeedReasoningNone) body.reasoning_effort = "none";
  }

  return body;
}

export const openAiCompatibleAdapter: LlmAdapter = {
  provider: "openai-compatible",

  async complete(
    req: LlmRequest,
    model: ModelEntry,
    apiKey: string,
  ): Promise<LlmResponse> {
    const body = buildOpenAiBody(req, model);

    let res: Response;
    try {
      res = await fetch(`${model.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        throw new LlmError("Quá thời gian chờ nhà cung cấp AI", "timeout");
      }
      throw new LlmError(`Không gọi được nhà cung cấp AI: ${e}`, "network");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new LlmError(
        `${model.provider} ${res.status}: ${text.slice(0, 300)}`,
        res.status === 401 || res.status === 403
          ? "auth"
          : res.status === 429
            ? "rate_limit"
            : res.status >= 500
              ? "server"
              : "bad_request",
        res.status,
      );
    }

    const data = (await res.json()) as OaiResponse;
    const choice = data.choices?.[0];
    if (!choice) throw new LlmError("Phản hồi rỗng từ nhà cung cấp", "server");

    const toolCalls: LlmToolCall[] = (choice.message.tool_calls ?? []).map(
      (t) => ({
        id: t.id,
        name: t.function.name,
        arguments: parseArgs(t.function.arguments),
      }),
    );

    return {
      text: choice.message.content ?? "",
      toolCalls,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
      rawModel: data.model ?? model.rawId,
      stopReason: mapStop(choice.finish_reason),
    };
  },
};
