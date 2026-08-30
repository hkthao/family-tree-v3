import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "../supabase";
import type { Proposal } from "./aiExtract";

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
  /**
   * Mã lượt đã sinh ra câu trả lời này — chỉ có ở câu trả lời của lượt
   * VỪA HỎI trong phiên hiện tại. Lịch sử tải từ server không mang mã
   * lượt, nên câu cũ không chấm điểm được: đó là chủ ý, chấm điểm cho
   * một câu hỏi từ tuần trước thì cũng không nhớ nổi nó đúng hay sai.
   */
  ref?: string;
  /** Điểm đã chấm trong phiên này (không tải lại từ server). */
  rating?: 1 | -1;
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
  /**
   * Đề xuất thêm người, khi trợ lý hiểu là người dùng đang KỂ chứ không
   * hỏi. Chỉ là đề xuất — chưa có gì được ghi vào gia phả.
   */
  proposal?: Proposal;
  /** Mã lượt, gửi lại khi bóc tách lại để không bị trừ lượt lần hai. */
  ref?: string;
  /** Số lượt còn lại sau câu này. `null` khi máy chủ chưa bật hạn mức. */
  credits?: number | null;
  /** Hết lượt tháng này — KHÔNG phải lỗi, xem plan §Đường lui. */
  quotaExhausted?: boolean;
}

export type AnswerRating = 1 | -1 | 0;

/**
 * Chấm điểm một câu trả lời của trợ lý.
 *
 * `0` = gỡ điểm (bấm lại đúng nút đã chọn). Máy chủ chỉ sửa được lượt
 * của chính người gọi — xem migration ai_answer_rating.
 *
 * Lỗi ở đây KHÔNG được làm hỏng khung chat: chấm điểm là việc phụ, hỏng
 * thì thôi, đừng ném một hộp lỗi đỏ vào giữa cuộc trò chuyện.
 */
export async function rateAnswer(
  ref: string,
  rating: AnswerRating,
): Promise<void> {
  const { error } = await supabase.rpc("ai_rate_turn", {
    p_ref: ref,
    p_rating: rating,
  });
  if (error) console.warn("không chấm điểm được:", error.message);
}

/** Số tin gửi lên làm ngữ cảnh. KHÁC số tin lưu để hiển thị. */
export const CONTEXT_TURNS = 8;

/**
 * Đọc SSE của `ai-chat`. Tách hàm thuần để test được: chỗ này từng là
 * nguồn bug kinh điển vì **một lần đọc mạng KHÔNG tương ứng một sự
 * kiện** — chunk bị cắt ở giữa dòng là chuyện bình thường.
 */
export function parseSseLines(buffer: string): {
  events: unknown[];
  rest: string;
} {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: unknown[] = [];
  for (const part of parts) {
    const line = part.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      /* mẩu rác giữa đường không được làm hỏng cả lượt */
    }
  }
  return { events, rest };
}

/**
 * Hỏi có stream. Trả về kết quả cuối; `onDelta` nhận từng mẩu chữ.
 *
 * Ném lỗi kèm `beforeFirstDelta` để người gọi biết có được phép rơi về
 * bản không stream hay không: rơi về sau khi đã hiện nửa câu là người
 * dùng thấy câu trả lời chạy hai lần.
 */
async function askStreaming(
  input: { clanId: string; question: string; history: ChatTurn[]; ref?: string },
  onDelta: (text: string) => void,
): Promise<AskResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Bạn cần đăng nhập lại.");

  let got = false;
  const fail = (message: string) => {
    const e = new Error(message) as Error & { beforeFirstDelta?: boolean };
    e.beforeFirstDelta = !got;
    return e;
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      clanId: input.clanId,
      question: input.question,
      history: input.history.slice(-CONTEXT_TURNS),
      ref: input.ref,
      stream: true,
    }),
  }).catch(() => {
    throw fail("Không kết nối được trợ lý. Kiểm tra mạng giúp nhé.");
  });

  // Máy chủ chưa có bản hỗ trợ stream (deploy lệch nhịp) → để người gọi
  // rơi về đường cũ thay vì báo lỗi.
  const kind = res.headers.get("content-type") ?? "";
  if (!res.ok || !res.body || !kind.includes("text/event-stream")) {
    throw fail("Trợ lý chưa sẵn sàng cho chế độ trả lời dần.");
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let done: AskResult | null = null;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += chunk.value;
    const parsed = parseSseLines(buffer);
    buffer = parsed.rest;
    for (const ev of parsed.events) {
      const e = ev as { type?: string; text?: string; message?: string };
      if (e.type === "delta" && e.text) {
        got = true;
        onDelta(e.text);
      } else if (e.type === "error") {
        throw fail(e.message || "Trợ lý gặp lỗi. Bạn thử lại nhé.");
      } else if (e.type === "done") {
        done = ev as AskResult;
      }
    }
  }

  if (!done) throw fail("Trợ lý trả lời dở chừng. Bạn thử lại nhé.");
  return done;
}

export async function askAssistant(input: {
  clanId: string;
  question: string;
  history: ChatTurn[];
  /** Lượt cũ đang được bóc tách lại — xem AskResult.ref. */
  ref?: string;
  /** Có truyền thì chữ hiện dần; thiếu thì chờ trả lời xong như trước. */
  onDelta?: (text: string) => void;
}): Promise<AskResult> {
  if (input.onDelta) {
    try {
      return await askStreaming(input, input.onDelta);
    } catch (e) {
      const before = (e as { beforeFirstDelta?: boolean }).beforeFirstDelta;
      // Hỏng SAU khi đã hiện chữ thì dừng hẳn: hỏi lại là người dùng bị
      // tính thêm một lượt và thấy hai câu trả lời chồng nhau.
      if (!before) throw e;
    }
  }
  const { data, error } = await supabase.functions.invoke<AskResult>("ai-chat", {
    body: {
      clanId: input.clanId,
      question: input.question,
      // Cắt ở đây, không cắt ở server: gửi cả lịch sử 40 tin sẽ làm
      // token đầu vào phình lên nhiều lần (xem plan §Chi phí).
      history: input.history.slice(-CONTEXT_TURNS),
      ref: input.ref,
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
