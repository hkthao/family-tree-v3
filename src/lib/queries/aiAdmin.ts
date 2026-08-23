import { supabase } from "../supabase";

/**
 * Cấu hình trợ lý AI cho platform admin.
 *
 * Khoá API **không bao giờ** đi qua đây theo chiều đọc — client chỉ thấy
 * metadata (gợi ý 4 ký tự cuối, kết quả kiểm tra gần nhất). Bản mã nằm ở
 * `ai_provider_keys`, bảng đó không có RLS policy nào nên trình duyệt
 * không select nổi kể cả khi là admin.
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

export interface KeyStatus {
  provider: AiProvider;
  hint: string;
  updated_at: string;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_model: string | null;
  last_test_error: string | null;
  last_test_ms: number | null;
}

export interface TestOutcome {
  ok: boolean;
  model: string | null;
  error: string | null;
  ms: number;
}

export async function listKeyStatus(): Promise<KeyStatus[]> {
  const { data, error } = await supabase.rpc("ai_provider_keys_status");
  if (error) throw new Error(error.message);
  return (data ?? []) as KeyStatus[];
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("ai-admin", { body });
  if (error) {
    // functions.invoke nuốt body của phản hồi lỗi — đọc lại để hiện đúng
    // lý do (thiếu AI_KEY_ENCRYPTION_KEY, khoá sai…), giống admin.ts.
    const res = (error as { context?: Response }).context;
    if (res) {
      try {
        const parsed = (await res.clone().json()) as { error?: string };
        if (parsed?.error) throw new Error(parsed.error);
      } catch (e) {
        if (e instanceof Error && !e.message.startsWith("Unexpected")) throw e;
      }
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Không nhận được phản hồi");
  return data;
}

export function setProviderKey(provider: AiProvider, apiKey: string) {
  return callAdmin<{ saved: boolean; test: TestOutcome }>({
    action: "set_key",
    provider,
    apiKey,
  });
}

export function testProviderKey(provider: AiProvider) {
  return callAdmin<{ test: TestOutcome }>({ action: "test_key", provider });
}

export function deleteProviderKey(provider: AiProvider) {
  return callAdmin<{ deleted: boolean }>({ action: "delete_key", provider });
}
