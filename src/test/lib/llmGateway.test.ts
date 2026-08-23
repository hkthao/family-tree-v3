import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildOpenAiBody } from "../../../supabase/functions/_shared/llm/adapters/openai-compatible";
import { TOOL_SPECS } from "../../../supabase/functions/ai-chat/toolSpecs";
import {
  DEFAULT_MODELS,
  MODELS,
  estimateCost,
  getModel,
} from "../../../supabase/functions/_shared/llm/registry";
import type {
  LlmRequest,
  ToolSpec,
} from "../../../supabase/functions/_shared/llm/types";

/**
 * Gateway đa nhà cung cấp vỡ ở những chỗ rất cụ thể. Test này canh đúng
 * các chỗ đó — xem docs/plan-ai-tro-ly.md §Cạm bẫy phải xử lý trong adapter.
 */

const TOOL: ToolSpec = {
  name: "search_person",
  description: "Tìm người",
  parameters: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
    additionalProperties: false,
  },
};

const baseReq: LlmRequest = {
  model: "gpt-5.6-luna",
  system: "Bạn là trợ lý gia phả.",
  messages: [{ role: "user", content: "Giỗ ông nội ngày nào?" }],
  maxTokens: 1200,
};

describe("shape nội bộ không có tham số sampling", () => {
  /**
   * Chỗ này quan trọng hơn nó trông: Claude Opus 5 / Sonnet 5 TỪ CHỐI
   * `temperature`, `top_p`, `top_k` bằng lỗi 400. Gateway nào cũng có
   * thói quen forward `temperature: 0.2` cho mọi provider — và đó là
   * cách nhanh nhất để cả tính năng chết trên production.
   *
   * Cách chắc nhất là để những tham số đó KHÔNG TỒN TẠI trong shape
   * chung. Test này quét mã nguồn để không ai "thêm cho tiện".
   */
  const LLM_DIR = "supabase/functions/_shared/llm";

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
    });
  }

  /** Bỏ comment để chỉ soi mã thật — comment có nhắc tên tham số là cố ý. */
  function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it("quét được đúng thư mục (chống test pass giả khi walk rỗng)", () => {
    expect(walk(LLM_DIR).length).toBeGreaterThanOrEqual(5);
  });

  it.each(["temperature", "top_p", "topP", "top_k", "topK"])(
    "không có mã nào gửi %s",
    (param) => {
      const files = walk(LLM_DIR);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf8"));
        expect(code, `${file} có nhắc tới ${param} trong mã thật`).not.toContain(
          param,
        );
      }
    },
  );
});

describe("buildOpenAiBody", () => {
  it("đặt system thành message đầu tiên", () => {
    const body = buildOpenAiBody(baseReq, getModel("gpt-5.6-luna"));
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0]).toEqual({ role: "system", content: baseReq.system });
    expect(messages[1]).toEqual({ role: "user", content: baseReq.messages[0].content });
  });

  it("dùng max_completion_tokens, không phải max_tokens", () => {
    const body = buildOpenAiBody(baseReq, getModel("gpt-5.6-luna"));
    expect(body.max_completion_tokens).toBe(1200);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("không gửi khối tools khi không có tool nào", () => {
    const body = buildOpenAiBody(baseReq, getModel("gpt-5.6-luna"));
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
  });

  it("bật strict khi schema đóng (additionalProperties:false)", () => {
    const body = buildOpenAiBody(
      { ...baseReq, tools: [TOOL] },
      getModel("gpt-5.6-luna"),
    );
    const tools = body.tools as Array<{ function: { strict: boolean } }>;
    expect(tools[0].function.strict).toBe(true);
  });

  /**
   * Lỗi thật gặp trên production: OpenAI trả 400 ngay khi gửi, vì
   * `upcoming_anniversaries` có tham số tuỳ chọn `days` mà `strict` lại
   * đòi `required` liệt kê đủ mọi key. Danh sách tool đi kèm MỌI request
   * nên một tool sai là chết cả tính năng, không phải chết riêng nó.
   *
   * Dùng TOOL_SPECS thật chứ không dựng schema giả — chính bộ tool thật
   * mới là thứ được gửi đi.
   */
  it("không bật strict cho tool có tham số tuỳ chọn (lỗi 400 của OpenAI)", () => {
    const body = buildOpenAiBody(
      { ...baseReq, tools: TOOL_SPECS },
      getModel("gpt-5.6-luna"),
    );
    const tools = body.tools as Array<{
      function: { name: string; strict: boolean; parameters: ToolSpec["parameters"] };
    }>;

    for (const t of tools) {
      if (!t.function.strict) continue;
      const required = new Set(t.function.parameters.required ?? []);
      for (const key of Object.keys(t.function.parameters.properties ?? {})) {
        expect(
          required.has(key),
          `tool ${t.function.name} bật strict nhưng thiếu "${key}" trong required`,
        ).toBe(true);
      }
    }

    const anniv = tools.find((t) => t.function.name === "upcoming_anniversaries");
    expect(anniv?.function.strict).toBe(false);
  });

  /**
   * Lỗi thật thứ hai trên production: model suy luận của OpenAI từ chối
   * tool trên /chat/completions nếu không tắt suy luận. Mặc định là CÓ
   * suy luận nên không gửi gì cũng dính — phải gửi "none" tường minh.
   */
  it("gửi reasoning_effort:none khi model suy luận dùng tool", () => {
    const body = buildOpenAiBody(
      { ...baseReq, tools: [TOOL] },
      getModel("gpt-5.6-luna"),
    );
    expect(body.reasoning_effort).toBe("none");
  });

  it("không gửi reasoning_effort khi không có tool", () => {
    const body = buildOpenAiBody(baseReq, getModel("gpt-5.6-luna"));
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("không gửi reasoning_effort cho model không cần (DeepSeek 400 vì tham số lạ)", () => {
    const body = buildOpenAiBody(
      { ...baseReq, model: "deepseek-v4-flash", tools: [TOOL] },
      getModel("deepseek-v4-flash"),
    );
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("không bật strict khi schema mở", () => {
    const open: ToolSpec = {
      ...TOOL,
      parameters: { type: "object", properties: {} },
    };
    const body = buildOpenAiBody(
      { ...baseReq, tools: [open] },
      getModel("gpt-5.6-luna"),
    );
    const tools = body.tools as Array<{ function: { strict: boolean } }>;
    expect(tools[0].function.strict).toBe(false);
  });

  it("serialise tool call của assistant và tool result kèm đúng id", () => {
    const body = buildOpenAiBody(
      {
        ...baseReq,
        messages: [
          { role: "user", content: "Ai là ông tổ?" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "call_1", name: "search_person", arguments: { name: "An" } },
            ],
          },
          { role: "tool", toolCallId: "call_1", content: "p1 · Nguyễn Văn An" },
        ],
      },
      getModel("gpt-5.6-luna"),
    );
    const messages = body.messages as Array<Record<string, unknown>>;
    const assistant = messages[2] as {
      tool_calls: Array<{ id: string; function: { arguments: string } }>;
    };
    expect(assistant.tool_calls[0].id).toBe("call_1");
    // arguments phải là CHUỖI JSON, không phải object — sai chỗ này là 400.
    expect(assistant.tool_calls[0].function.arguments).toBe('{"name":"An"}');
    expect(messages[3]).toMatchObject({
      role: "tool",
      tool_call_id: "call_1",
    });
  });

  it("gửi rawId của provider, không gửi id nội bộ", () => {
    const body = buildOpenAiBody(
      { ...baseReq, model: "deepseek-v4-flash" },
      getModel("deepseek-v4-flash"),
    );
    expect(body.model).toBe("deepseek-v4-flash");
  });
});

describe("registry", () => {
  it("mọi model đều khai đủ giá và biến môi trường chứa khoá", () => {
    for (const [id, m] of Object.entries(MODELS)) {
      expect(m.id, `${id} lệch key`).toBe(id);
      expect(m.apiKeyEnv, `${id} thiếu apiKeyEnv`).toMatch(/_API_KEY$/);
      expect(m.priceIn, `${id} thiếu giá vào`).toBeGreaterThan(0);
      expect(m.priceOut, `${id} thiếu giá ra`).toBeGreaterThan(0);
      // Cache rẻ hơn hẳn là tiền đề của cả phần tối ưu chi phí.
      expect(m.priceCachedIn, `${id} giá cache không rẻ hơn`).toBeLessThan(m.priceIn);
      if (m.provider === "openai-compatible") {
        expect(m.baseUrl, `${id} thiếu baseUrl`).toBeTruthy();
      }
      // credential phải khớp apiKeyEnv, nếu không màn hình quản trị sẽ
      // cắm khoá vào một chỗ mà gateway không đọc tới.
      expect(m.apiKeyEnv, `${id}: credential lệch apiKeyEnv`).toBe(
        `${m.credential.toUpperCase()}_API_KEY`,
      );
    }
  });

  it("mỗi credential đều có ít nhất một model để kiểm tra kết nối", () => {
    // Màn hình quản trị gọi thử bằng model rẻ nhất của nhà cung cấp —
    // credential không có model nào thì nút "Kiểm tra" thành vô dụng.
    for (const cred of ["openai", "anthropic", "deepseek"] as const) {
      const has = Object.values(MODELS).some((m) => m.credential === cred);
      expect(has, `không có model nào dùng credential ${cred}`).toBe(true);
    }
  });

  it("model mặc định phải có thật trong registry", () => {
    expect(() => getModel(DEFAULT_MODELS.qa)).not.toThrow();
    expect(() => getModel(DEFAULT_MODELS.extract)).not.toThrow();
  });

  it("báo lỗi rõ ràng khi cấu hình model lạ", () => {
    expect(() => getModel("model-khong-ton-tai")).toThrow(/registry/);
  });

  it("tính token cache theo giá cache, phần còn lại theo giá thường", () => {
    const m = getModel("gpt-5.6-luna"); // 0,20 / 0,02 / 1,20
    const cost = estimateCost(m, {
      inputTokens: 6_000,
      cachedInputTokens: 4_000,
      outputTokens: 600,
    });
    // (2000×0,20 + 4000×0,02 + 600×1,20) / 1e6
    expect(cost).toBeCloseTo(0.0012, 6);
  });

  it("không tính âm khi provider báo cached nhiều hơn input", () => {
    const m = getModel("gpt-5.6-luna");
    const cost = estimateCost(m, {
      inputTokens: 100,
      cachedInputTokens: 500,
      outputTokens: 0,
    });
    expect(cost).toBeGreaterThanOrEqual(0);
  });
});
