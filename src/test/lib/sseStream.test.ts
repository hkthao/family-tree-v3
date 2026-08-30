import { describe, expect, it } from "vitest";

import {
  applyOaiChunk,
  finishStream,
  newStreamState,
  splitSseEvents,
  sseData,
} from "../../../supabase/functions/_shared/llm/adapters/openai-compatible";
import { getModel } from "../../../supabase/functions/_shared/llm/registry";
import { parseSseLines } from "@/lib/queries/aiChat";

/**
 * Đọc SSE — chỗ dễ vỡ nhất của phần trả lời dần.
 *
 * Bug kinh điển là tưởng "một lần đọc mạng = một sự kiện". Không phải:
 * chunk bị cắt ở giữa dòng, ở giữa chữ `data:`, hay gộp năm sự kiện vào
 * một lần đọc — đều là chuyện bình thường. Nên mấy ca dưới đây cắt chuỗi
 * ở đúng những chỗ khó chịu đó.
 */

describe("splitSseEvents", () => {
  it("chỉ trả sự kiện HOÀN CHỈNH, giữ phần dở lại", () => {
    const { events, rest } = splitSseEvents("data: a\n\ndata: b\n\ndata: c");
    expect(events).toEqual(["data: a", "data: b"]);
    expect(rest).toBe("data: c");
  });

  it("chunk cắt giữa chữ 'data:' vẫn ghép lại đúng", () => {
    let buf = "";
    const collected: string[] = [];
    for (const piece of ['data: {"x":1}\n', "\nda", "ta: ", '{"y":2}\n\n']) {
      buf += piece;
      const r = splitSseEvents(buf);
      buf = r.rest;
      collected.push(...r.events);
    }
    expect(collected.map(sseData)).toEqual(['{"x":1}', '{"y":2}']);
  });

  it("[DONE] và dòng trống không phải dữ liệu", () => {
    expect(sseData("data: [DONE]")).toBeNull();
    expect(sseData(": ping")).toBeNull();
    expect(sseData("data:")).toBeNull();
  });
});

describe("applyOaiChunk", () => {
  const model = getModel("gpt-5.6-luna");

  it("ghép chữ theo từng mẩu và trả về ĐÚNG mẩu mới", () => {
    const st = newStreamState();
    expect(applyOaiChunk(st, { choices: [{ delta: { content: "Chào " } }] })).toBe(
      "Chào ",
    );
    expect(applyOaiChunk(st, { choices: [{ delta: { content: "bạn" } }] })).toBe(
      "bạn",
    );
    expect(st.text).toBe("Chào bạn");
  });

  it("ghép tool call theo INDEX — mẩu sau không mang id", () => {
    const st = newStreamState();
    applyOaiChunk(st, {
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: "call_1", function: { name: "search_person", arguments: '{"na' } },
            ],
          },
        },
      ],
    });
    applyOaiChunk(st, {
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'me":"An"}' } }] } }],
    });
    const res = finishStream(st, model);
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0].id).toBe("call_1");
    expect(res.toolCalls[0].arguments).toEqual({ name: "An" });
  });

  it("lấy usage ở chunk cuối — thiếu là ghi chi phí bằng 0", () => {
    const st = newStreamState();
    applyOaiChunk(st, { choices: [{ delta: { content: "x" }, finish_reason: "stop" }] });
    applyOaiChunk(st, {
      model: "gpt-5.6-luna-2026",
      usage: {
        prompt_tokens: 120,
        completion_tokens: 8,
        prompt_tokens_details: { cached_tokens: 100 },
      },
    });
    const res = finishStream(st, model);
    expect(res.usage).toEqual({
      inputTokens: 120,
      outputTokens: 8,
      cachedInputTokens: 100,
    });
    expect(res.rawModel).toBe("gpt-5.6-luna-2026");
    expect(res.stopReason).toBe("end_turn");
  });

  it("chunk rỗng (keep-alive) không làm hỏng gì", () => {
    const st = newStreamState();
    expect(applyOaiChunk(st, {})).toBe("");
    expect(applyOaiChunk(st, { choices: [] })).toBe("");
    expect(st.text).toBe("");
  });
});

describe("parseSseLines — phía trình duyệt", () => {
  it("đọc được nhiều sự kiện trong một lần đọc", () => {
    const { events, rest } = parseSseLines(
      'data: {"type":"delta","text":"a"}\n\ndata: {"type":"done","answer":"xong"}\n\n',
    );
    expect(events).toEqual([
      { type: "delta", text: "a" },
      { type: "done", answer: "xong" },
    ]);
    expect(rest).toBe("");
  });

  it("json hỏng giữa đường bị bỏ qua, không ném lỗi ra giao diện", () => {
    const { events } = parseSseLines('data: {hỏng\n\ndata: {"type":"delta","text":"b"}\n\n');
    expect(events).toEqual([{ type: "delta", text: "b" }]);
  });

  it("giữ lại sự kiện chưa trọn vẹn để đọc tiếp", () => {
    const { events, rest } = parseSseLines('data: {"type":"delta","te');
    expect(events).toEqual([]);
    expect(rest).toBe('data: {"type":"delta","te');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Luật retry khi đã bắn chữ

import { shouldRetry } from "../../../supabase/functions/_shared/llm/retry";
import { LlmError } from "../../../supabase/functions/_shared/llm/types";

describe("shouldRetry", () => {
  const boom = new LlmError("máy chủ lỗi", "server", 503);
  const base = { emitted: false, attempt: 1, maxAttempts: 3 };

  it("thử lại lỗi tạm thời khi chưa bắn chữ nào", () => {
    expect(shouldRetry(boom, base)).toBe(true);
  });

  it("KHÔNG thử lại khi người dùng đã thấy chữ — tránh hai câu dính nhau", () => {
    expect(shouldRetry(boom, { ...base, emitted: true })).toBe(false);
  });

  it("không thử lại ở lần cuối", () => {
    expect(shouldRetry(boom, { ...base, attempt: 3 })).toBe(false);
  });

  it("không thử lại lỗi của chính mình (sai tham số, sai khoá)", () => {
    expect(shouldRetry(new LlmError("sai khoá", "auth", 401), base)).toBe(false);
    expect(shouldRetry(new LlmError("sai tham số", "bad_request", 400), base)).toBe(
      false,
    );
  });

  it("lỗi lạ không phải LlmError thì thôi, đừng thử lại mò", () => {
    expect(shouldRetry(new Error("gì đó"), base)).toBe(false);
  });
});
