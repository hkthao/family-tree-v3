import { describe, expect, it } from "vitest";

import {
  AI_PROVIDERS,
  QA_MODELS,
  providerLabelForModel,
} from "@/lib/aiModels";

/**
 * Dòng chữ "câu hỏi của bạn được gửi tới X" suy ra từ đây. Sai bảng này
 * là nói sai với người dùng về nơi dữ liệu gia phả của họ đi tới — hỏng
 * kiểu im lặng, không ai phát hiện được bằng mắt.
 */
describe("providerLabelForModel", () => {
  it("suy đúng tên nhà cung cấp từ id model", () => {
    expect(providerLabelForModel("gpt-5.6-luna")).toBe("OpenAI");
    expect(providerLabelForModel("claude-sonnet-5")).toBe("Anthropic (Claude)");
    expect(providerLabelForModel("deepseek-v4-flash")).toBe("DeepSeek");
  });

  it("model lạ hoặc chưa tải xong thì KHÔNG đoán bừa", () => {
    expect(providerLabelForModel("model-la")).toBeNull();
    expect(providerLabelForModel(null)).toBeNull();
    expect(providerLabelForModel(undefined)).toBeNull();
  });

  it("mọi model đều trỏ tới một nhà cung cấp có thật", () => {
    for (const m of QA_MODELS) {
      expect(
        AI_PROVIDERS.some((p) => p.id === m.credential),
        `model ${m.id} trỏ tới credential lạ: ${m.credential}`,
      ).toBe(true);
      expect(providerLabelForModel(m.id)).not.toBeNull();
    }
  });
});
