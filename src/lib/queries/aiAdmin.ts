import { supabase } from "../supabase";
import {
  AI_PROVIDERS,
  QA_MODELS,
  type AiProvider,
} from "../aiModels";

// Re-export: màn quản trị vẫn import từ đây như cũ.
export { AI_PROVIDERS, QA_MODELS };
export type { AiProvider };
import { getPlatformSetting, setPlatformSetting } from "./platformSettings";

/**
 * Cấu hình trợ lý AI cho platform admin.
 *
 * Khoá API **không bao giờ** đi qua đây theo chiều đọc — client chỉ thấy
 * metadata (gợi ý 4 ký tự cuối, kết quả kiểm tra gần nhất). Bản mã nằm ở
 * `ai_provider_keys`, bảng đó không có RLS policy nào nên trình duyệt
 * không select nổi kể cả khi là admin.
 */

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

/**
 * Ném ra khi phần AI chưa được cài lên môi trường đang chạy.
 *
 * Có thật chứ không phải phòng xa: prod là Supabase tự host và migration
 * **áp bằng tay**, nên frontend hoàn toàn có thể lên trước database. Khi
 * đó gọi RPC sẽ nhận 404 (PostgREST `PGRST202`) — phải nhận diện được để
 * hiện hướng dẫn cài đặt, thay vì quăng một lỗi kỹ thuật vào mặt admin.
 */
export class AiNotInstalledError extends Error {
  constructor() {
    super("Phần trợ lý AI chưa được cài trên máy chủ này.");
    this.name = "AiNotInstalledError";
  }
}

/** PostgREST trả mã này khi không tìm thấy hàm/bảng trong schema cache. */
function isMissingObject(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42883" || // undefined_function
    error.code === "42P01" || // undefined_table
    /could not find the function|schema cache/i.test(error.message ?? "")
  );
}

export async function listKeyStatus(): Promise<KeyStatus[]> {
  const { data, error } = await supabase.rpc("ai_provider_keys_status");
  if (error) {
    if (isMissingObject(error)) throw new AiNotInstalledError();
    throw new Error(error.message);
  }
  return (data ?? []) as KeyStatus[];
}

/**
 * Edge Function chưa lên máy chủ, hoặc lên nhưng thiếu file.
 *
 * Runtime của Supabase self-host trả nguyên văn
 * "InvalidWorkerCreation: worker boot error: … could not find an
 * appropriate entrypoint" — đúng nhưng vô nghĩa với người vận hành. Đổi
 * thành câu nói rõ phải làm gì.
 */
function friendlyFunctionError(msg: string): string | null {
  if (/InvalidWorkerCreation|could not find an appropriate entrypoint|worker boot error/i.test(msg)) {
    return (
      "Edge Function chưa được cài đầy đủ trên máy chủ (thiếu file). " +
      "Chạy workflow deploy-functions rồi thử lại."
    );
  }
  if (/BOOT_ERROR|Module not found|Relative import path/i.test(msg)) {
    return (
      "Edge Function lên máy chủ nhưng thiếu thư mục _shared. " +
      "Chạy lại workflow deploy-functions."
    );
  }
  return null;
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("ai-admin", { body });
  if (error) {
    // functions.invoke nuốt body của phản hồi lỗi — đọc lại để hiện đúng
    // lý do (thiếu AI_KEY_ENCRYPTION_KEY, khoá sai…), giống admin.ts.
    const res = (error as { context?: Response }).context;
    if (res) {
      try {
        const parsed = (await res.clone().json()) as { error?: string; msg?: string };
        const raw = parsed?.error ?? parsed?.msg;
        if (raw) throw new Error(friendlyFunctionError(raw) ?? raw);
      } catch (e) {
        if (e instanceof Error && !e.message.startsWith("Unexpected")) throw e;
      }
    }
    throw new Error(friendlyFunctionError(error.message) ?? error.message);
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

// ─── Công tắc tổng + định tuyến model ────────────────────────────────
// Để trong platform_settings (đọc công khai — chỉ tên model, không phải
// khoá). Có UI cho phần này vì nếu không thì bật/tắt trợ lý phải chạy SQL
// qua SSH, và đó đúng là thứ hay tắc.

export const AI_ENABLED_KEY = "ai.enabled";
export const AI_MODEL_QA_KEY = "ai.model.qa";

/** Model cho phép chọn ở UI. Phải khớp registry.ts của Edge Function. */
export interface AiConfig {
  enabled: boolean;
  qaModel: string;
}

export async function getAiConfig(): Promise<AiConfig> {
  const [enabled, qaModel] = await Promise.all([
    getPlatformSetting(AI_ENABLED_KEY),
    getPlatformSetting(AI_MODEL_QA_KEY),
  ]);
  return { enabled: enabled === "true", qaModel: qaModel || "gpt-5.6-luna" };
}

export interface AiSpendToday {
  spentUsd: number;
  capUsd: number;
}

/**
 * Chi phí AI đã tiêu hôm nay và trần đang đặt.
 *
 * Có ngắt mạch mà không ai nhìn thấy con số thì admin chỉ biết trợ lý
 * "tự nhiên im" — nên số này phải hiện ngay cạnh công tắc tổng.
 *
 * `capUsd = 0` nghĩa là đã tắt ngắt mạch; chưa áp migration thì
 * `spentUsd` về 0 chứ không ném lỗi ra màn hình quản trị.
 */
export async function getAiSpendToday(): Promise<AiSpendToday> {
  const [{ data: spend }, cap] = await Promise.all([
    supabase.rpc("ai_spend_today"),
    getPlatformSetting("ai.daily_cost_cap_usd"),
  ]);
  return {
    spentUsd: Number(spend ?? 0),
    capUsd: Number(cap ?? "0"),
  };
}

export async function setAiEnabled(on: boolean): Promise<void> {
  await setPlatformSetting(AI_ENABLED_KEY, on ? "true" : "false");
}

export async function setQaModel(modelId: string): Promise<void> {
  if (!QA_MODELS.some((m) => m.id === modelId)) {
    throw new Error(`Model không hợp lệ: ${modelId}`);
  }
  await setPlatformSetting(AI_MODEL_QA_KEY, modelId);
}
