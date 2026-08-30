/**
 * Model hỏi đáp và nhà cung cấp đứng sau — bảng dùng CHUNG.
 *
 * Trước đây hai bảng này nằm trong queries/aiAdmin.ts, tức là chỉ màn
 * quản trị thấy. Nhưng khung chat cũng cần: nó phải nói cho người dùng
 * biết câu hỏi đang được gửi tới ai. Nói tên cố định trong giao diện là
 * sai ngay lần đầu admin đổi model, nên tên phải suy ra từ cấu hình.
 */

export type AiProvider = "openai" | "anthropic" | "deepseek";

export const AI_PROVIDERS: Array<{
  id: AiProvider;
  label: string;
  hint: string;
}> = [
  { id: "openai", label: "OpenAI", hint: "Khoá bắt đầu bằng sk-" },
  { id: "anthropic", label: "Anthropic (Claude)", hint: "Khoá bắt đầu bằng sk-ant-" },
  { id: "deepseek", label: "DeepSeek", hint: "Khoá bắt đầu bằng sk-" },
];

export const QA_MODELS = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna — rẻ nhất", credential: "openai" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", credential: "openai" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4-Flash", credential: "deepseek" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", credential: "anthropic" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — tool tốt nhất", credential: "anthropic" },
] as const;


/**
 * Tên nhà cung cấp đang xử lý câu hỏi, suy từ id model đang cấu hình.
 * Model lạ (chưa kịp thêm vào bảng) thì trả null — thà không nói gì còn
 * hơn nói tên sai.
 */
export function providerLabelForModel(modelId: string | null | undefined): string | null {
  const model = QA_MODELS.find((m) => m.id === modelId);
  if (!model) return null;
  return AI_PROVIDERS.find((p) => p.id === model.credential)?.label ?? null;
}
