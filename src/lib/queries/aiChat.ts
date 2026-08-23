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
