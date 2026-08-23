/**
 * ai-admin — nhập khoá API và kiểm tra kết nối, cho platform admin.
 *
 * Vì sao phải qua edge function chứ không ghi thẳng bảng: khoá được mã
 * hoá AES-GCM bằng KEK nằm trong env của edge function
 * (_shared/llm/crypto.ts). Postgres không bao giờ thấy bản rõ lẫn KEK, và
 * bảng `ai_provider_keys` không có RLS policy nào nên trình duyệt cũng
 * không ghi trực tiếp được.
 *
 * Ba hành động:
 *   set_key    — lưu khoá (mã hoá), rồi tự kiểm tra kết nối luôn
 *   test_key   — gọi thử nhà cung cấp bằng khoá đang lưu
 *   delete_key — xoá khoá
 *
 * Đọc trạng thái (đã cắm khoá nào, lần kiểm tra gần nhất) thì client gọi
 * thẳng RPC `ai_provider_keys_status()` — hàm đó chỉ trả metadata, không
 * bao giờ trả bản mã.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { err, json, preflight } from "../_shared/cors.ts";
import { encryptSecret, hintOf } from "../_shared/llm/crypto.ts";
import { complete } from "../_shared/llm/gateway.ts";
import { resolveApiKey, clearKeyCache } from "../_shared/llm/keys.ts";
import { MODELS } from "../_shared/llm/registry.ts";
import type { ModelEntry } from "../_shared/llm/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Credential = ModelEntry["credential"];
const CREDENTIALS: Credential[] = ["openai", "anthropic", "deepseek"];

interface Body {
  action?: "set_key" | "test_key" | "delete_key";
  provider?: string;
  /** Chỉ có ở set_key. Không bao giờ được log. */
  apiKey?: string;
}

/** Model rẻ nhất của nhà cung cấp — dùng làm phép thử cho đỡ tốn. */
function cheapestModelFor(cred: Credential): ModelEntry | null {
  const list = Object.values(MODELS).filter((m) => m.credential === cred);
  if (!list.length) return null;
  return list.reduce((a, b) => (b.priceIn < a.priceIn ? b : a));
}

interface TestOutcome {
  ok: boolean;
  model: string | null;
  error: string | null;
  ms: number;
}

/**
 * Gọi thật nhà cung cấp bằng một câu ngắn nhất có thể.
 *
 * Có tốn tiền, nhưng vài chục token — đổi lại admin biết chắc khoá dùng
 * được thay vì phát hiện lúc người dùng đầu tiên hỏi. Không gửi kèm tool
 * để phép thử không phụ thuộc vào việc nhà cung cấp có hỗ trợ tool hay không.
 */
async function testConnection(
  sbAdmin: ReturnType<typeof createClient>,
  cred: Credential,
): Promise<TestOutcome> {
  const model = cheapestModelFor(cred);
  if (!model) {
    return { ok: false, model: null, error: "Không có model nào cho nhà cung cấp này", ms: 0 };
  }
  const started = Date.now();
  try {
    clearKeyCache(); // buộc đọc lại khoá vừa lưu
    const apiKey = await resolveApiKey(sbAdmin, model);
    const res = await complete(
      {
        model: model.id,
        system: "Trả lời đúng một từ.",
        messages: [{ role: "user", content: "Nói: OK" }],
        maxTokens: 16,
        effort: "low",
      },
      apiKey,
    );
    return {
      ok: true,
      model: res.rawModel || model.id,
      error: null,
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      model: model.id,
      // Thông báo của nhà cung cấp có thể chứa mảnh khoá trong echo lỗi —
      // cắt ngắn và không log ra console.
      error: String((e as Error)?.message ?? e).slice(0, 300),
      ms: Date.now() - started,
    };
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return err("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err("Cần đăng nhập", 401);

  const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userRes } = await sbUser.auth.getUser();
  const user = userRes?.user;
  if (!user) return err("Phiên đăng nhập đã hết hạn", 401);

  // Kiểm quyền ở SERVER, không tin UI. Đọc qua sbUser để RLS của profiles
  // áp dụng bình thường.
  const { data: me } = await sbUser
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_platform_admin) return err("Không có quyền", 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err("Dữ liệu gửi lên không hợp lệ", 400);
  }

  const provider = body.provider as Credential | undefined;
  if (!provider || !CREDENTIALS.includes(provider)) {
    return err(`Nhà cung cấp không hợp lệ. Chọn: ${CREDENTIALS.join(", ")}`, 400);
  }

  switch (body.action) {
    case "set_key": {
      const key = body.apiKey?.trim();
      if (!key) return err("Chưa nhập khoá", 400);
      if (key.length < 20) return err("Khoá trông không đúng — quá ngắn", 400);

      let ciphertext: string;
      try {
        ciphertext = await encryptSecret(key);
      } catch (e) {
        // Thiếu/sai AI_KEY_ENCRYPTION_KEY. Nói rõ cách sửa.
        return err((e as Error).message, 500);
      }

      const { error: upErr } = await sbAdmin.from("ai_provider_keys").upsert(
        {
          provider,
          ciphertext,
          hint: hintOf(key),
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "provider" },
      );
      if (upErr) return err(`Không lưu được khoá: ${upErr.message}`, 500);

      // Lưu xong kiểm luôn — admin không phải bấm hai lần để biết kết quả.
      const outcome = await testConnection(sbAdmin, provider);
      await sbAdmin
        .from("ai_provider_keys")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_ok: outcome.ok,
          last_test_model: outcome.model,
          last_test_error: outcome.error,
          last_test_ms: outcome.ms,
        })
        .eq("provider", provider);

      return json({ saved: true, test: outcome });
    }

    case "test_key": {
      const outcome = await testConnection(sbAdmin, provider);
      await sbAdmin
        .from("ai_provider_keys")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_ok: outcome.ok,
          last_test_model: outcome.model,
          last_test_error: outcome.error,
          last_test_ms: outcome.ms,
        })
        .eq("provider", provider);
      return json({ test: outcome });
    }

    case "delete_key": {
      const { error: delErr } = await sbAdmin
        .from("ai_provider_keys")
        .delete()
        .eq("provider", provider);
      if (delErr) return err(`Không xoá được: ${delErr.message}`, 500);
      clearKeyCache();
      return json({ deleted: true });
    }

    default:
      return err("Hành động không hợp lệ", 400);
  }
});
