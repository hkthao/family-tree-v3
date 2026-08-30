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

/**
 * Ba con số điều khiển tiền bạc của trợ lý, trước nay chỉ đổi được bằng
 * câu SQL gõ tay trên máy chủ.
 *
 * Đưa lên giao diện vì đây đúng là thứ phải chỉnh theo thực tế: hạn mức
 * chật quá thì người dùng cụt hứng, trần chi phí thấp quá thì trợ lý tắt
 * giữa ngày. Bắt admin ssh vào máy chủ để sửa một con số là cách chắc
 * chắn khiến nó không bao giờ được sửa.
 */
export interface AiLimits {
  freePerMonth: number;
  dailyCapUsd: number;
  retentionDays: number;
  /** Mức chung cho dòng họ chưa đặt riêng. 0 = không giới hạn. */
  clanDailyLimit: number;
  clanMonthlyLimit: number;
}

export const AI_LIMIT_KEYS = {
  freePerMonth: "ai.free_per_month",
  dailyCapUsd: "ai.daily_cost_cap_usd",
  retentionDays: "ai.chat_retention_days",
  clanDailyLimit: "ai.clan_daily_limit",
  clanMonthlyLimit: "ai.clan_monthly_limit",
} as const;

/** Chặn số vô lý ngay ở client; server vẫn có mặc định an toàn riêng. */
export const AI_LIMIT_RANGE = {
  freePerMonth: { min: 0, max: 1000 },
  dailyCapUsd: { min: 0, max: 10_000 },
  retentionDays: { min: 1, max: 3650 },
  clanDailyLimit: { min: 0, max: 100_000 },
  clanMonthlyLimit: { min: 0, max: 1_000_000 },
} as const;

export async function getAiLimits(): Promise<AiLimits> {
  const [free, cap, retention, clanDaily, clanMonthly] = await Promise.all([
    getPlatformSetting(AI_LIMIT_KEYS.freePerMonth),
    getPlatformSetting(AI_LIMIT_KEYS.dailyCapUsd),
    getPlatformSetting(AI_LIMIT_KEYS.retentionDays),
    getPlatformSetting(AI_LIMIT_KEYS.clanDailyLimit),
    getPlatformSetting(AI_LIMIT_KEYS.clanMonthlyLimit),
  ]);
  return {
    freePerMonth: Number(free ?? 10),
    dailyCapUsd: Number(cap ?? 20),
    retentionDays: Number(retention ?? 90),
    clanDailyLimit: Number(clanDaily ?? 200),
    clanMonthlyLimit: Number(clanMonthly ?? 0),
  };
}

export async function setAiLimits(next: AiLimits): Promise<void> {
  for (const [field, key] of Object.entries(AI_LIMIT_KEYS) as Array<
    [keyof AiLimits, string]
  >) {
    const value = next[field];
    const range = AI_LIMIT_RANGE[field];
    if (!Number.isFinite(value) || value < range.min || value > range.max) {
      throw new Error(
        `Giá trị không hợp lệ cho ${key}: phải trong khoảng ${range.min}–${range.max}.`,
      );
    }
    await setPlatformSetting(key, String(value));
  }
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
