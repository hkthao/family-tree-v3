import { supabase } from "../supabase";

/**
 * Gọi Edge Function `ai-chat`.
 *
 * `functions.invoke` gói mọi phản hồi non-2xx thành FunctionsHttpError và
 * nuốt mất body, nên người dùng chỉ thấy chuỗi chung chung. Ta đọc lại
 * body để hiện đúng lý do ("Bạn hỏi hơi nhanh…", "Trợ lý đang tạm nghỉ…")
 * — cùng cách `admin.ts` đang làm.
 */

/**
 * Công tắc tổng của trợ lý, đọc từ `platform_settings` (bảng này đọc
 * công khai nên client lấy trực tiếp được).
 *
 * Vì sao cần, ngoài feature-flag theo dòng họ: `clans.disabled_features`
 * là **opt-out** — dòng họ nào chưa cấu hình gì thì mặc định BẬT hết. Nếu
 * chỉ dựa vào đó, ngay khi deploy là mọi dòng họ đều thấy nút "Trợ lý
 * dòng họ", bấm vào thì lỗi vì edge function/khoá chưa sẵn sàng.
 *
 * Nên trợ lý cần CẢ HAI: công tắc tổng (mặc định tắt) và cờ theo dòng họ.
 */
export async function isAiEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "ai.enabled")
    .maybeSingle();
  if (error) return false; // chưa áp migration → coi như tắt
  return data?.value === "true";
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Một dòng thô đọc từ `ai_messages`. */
export interface StoredMessage {
  role: string;
  content: string;
  created_at: string;
}

/**
 * Sắp lại đúng thứ tự thời gian, và **hoà thì câu hỏi đứng trước câu
 * trả lời**.
 *
 * Cần luật hoà vì các bản ghi cũ được chèn hai dòng trong CÙNG một câu
 * lệnh nên `now()` cho ra timestamp y hệt nhau; sắp theo created_at
 * không đủ, và người dùng thấy câu trả lời nằm trên câu hỏi. Từ nay
 * server ghi lệch 1ms (xem persistTurn), nhưng dữ liệu cũ vẫn phải hiện
 * đúng nên luật này ở lại.
 *
 * Tách hàm thuần để test được mà không cần database.
 */
export function orderTurns(rows: StoredMessage[]): ChatTurn[] {
  const rank = (r: string) => (r === "user" ? 0 : 1);
  return [...rows]
    .sort((a, b) => {
      const t = Date.parse(a.created_at) - Date.parse(b.created_at);
      return t !== 0 ? t : rank(a.role) - rank(b.role);
    })
    .map((m) => ({ role: m.role as ChatTurn["role"], content: m.content }));
}

/** Lịch sử lưu ở server — nguồn sự thật; localStorage chỉ là cache. */
export async function loadServerHistory(clanId: string): Promise<ChatTurn[]> {
  // Đọc trực tiếp: RLS của ai_messages là `owner_id = auth.uid()` nên chỉ
  // ra tin của chính người đang đăng nhập. Không cần endpoint riêng.
  //
  // Lấy 40 tin MỚI NHẤT (desc + limit) rồi mới sắp lại xuôi thời gian —
  // sắp xuôi ngay từ query sẽ lấy nhầm 40 tin CŨ nhất.
  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return orderTurns((data ?? []) as StoredMessage[]);
}

/** Xoá lịch sử phía server của chính mình trong một dòng họ. */
export async function clearServerHistory(clanId: string): Promise<void> {
  const { error } = await supabase
    .from("ai_messages")
    .delete()
    .eq("clan_id", clanId);
  if (error) throw new Error(error.message);
}

export interface AskResult {
  answer: string;
  toolCalls: number;
  /** Số lượt còn lại sau câu này. `null` khi máy chủ chưa bật hạn mức. */
  credits?: number | null;
  /** Hết lượt tháng này — KHÔNG phải lỗi, xem plan §Đường lui. */
  quotaExhausted?: boolean;
}

/** Số tin gửi lên làm ngữ cảnh. KHÁC số tin lưu để hiển thị. */
export const CONTEXT_TURNS = 8;

export async function askAssistant(input: {
  clanId: string;
  question: string;
  history: ChatTurn[];
}): Promise<AskResult> {
  const { data, error } = await supabase.functions.invoke<AskResult>("ai-chat", {
    body: {
      clanId: input.clanId,
      question: input.question,
      // Cắt ở đây, không cắt ở server: gửi cả lịch sử 40 tin sẽ làm
      // token đầu vào phình lên nhiều lần (xem plan §Chi phí).
      history: input.history.slice(-CONTEXT_TURNS),
    },
  });

  if (error) {
    const res = (error as { context?: Response }).context;
    if (res) {
      try {
        const body = (await res.clone().json()) as { error?: string; msg?: string };
        const raw = body?.error ?? body?.msg;
        if (raw) {
          // Runtime self-host trả lỗi boot bằng thuật ngữ nội bộ —
          // người dùng cuối không cần đọc thứ đó.
          throw new Error(
            /InvalidWorkerCreation|worker boot error|Module not found/i.test(raw)
              ? "Trợ lý chưa sẵn sàng trên máy chủ. Vui lòng báo quản trị viên."
              : raw,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.startsWith("Unexpected")) {
          throw e;
        }
      }
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Trợ lý không trả lời. Bạn thử lại nhé.");
  return data;
}
