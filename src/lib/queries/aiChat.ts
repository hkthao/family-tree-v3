import { supabase } from "../supabase";

/**
 * Gọi Edge Function `ai-chat`.
 *
 * `functions.invoke` gói mọi phản hồi non-2xx thành FunctionsHttpError và
 * nuốt mất body, nên người dùng chỉ thấy chuỗi chung chung. Ta đọc lại
 * body để hiện đúng lý do ("Bạn hỏi hơi nhanh…", "Trợ lý đang tạm nghỉ…")
 * — cùng cách `admin.ts` đang làm.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * `database.types.ts` được sinh tự động từ schema, mà `ai_messages` vừa
 * thêm ở migration 20260823140000 nên chưa có trong đó. Ép kiểu ĐÚNG MỘT
 * CHỖ ở đây thay vì rải `as any` khắp nơi.
 *
 * Bỏ dòng này sau khi áp migration và chạy lại lệnh sinh types.
 */
const untyped = supabase as unknown as {
  from(table: string): {
    select(cols: string): {
      eq(col: string, v: string): {
        order(col: string, o: { ascending: boolean }): {
          limit(n: number): Promise<{
            data: Array<{ role: string; content: string }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    delete(): {
      eq(col: string, v: string): Promise<{ error: { message: string } | null }>;
    };
  };
};

/** Lịch sử lưu ở server — nguồn sự thật; localStorage chỉ là cache. */
export async function loadServerHistory(clanId: string): Promise<ChatTurn[]> {
  // Đọc trực tiếp: RLS của ai_messages là `owner_id = auth.uid()` nên chỉ
  // ra tin của chính người đang đăng nhập. Không cần endpoint riêng.
  const { data, error } = await untyped
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).reverse().map((m) => ({
    role: m.role as ChatTurn["role"],
    content: m.content,
  }));
}

/** Xoá lịch sử phía server của chính mình trong một dòng họ. */
export async function clearServerHistory(clanId: string): Promise<void> {
  const { error } = await untyped
    .from("ai_messages")
    .delete()
    .eq("clan_id", clanId);
  if (error) throw new Error(error.message);
}

export interface AskResult {
  answer: string;
  toolCalls: number;
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
        const body = (await res.clone().json()) as { error?: string };
        if (body?.error) throw new Error(body.error);
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
