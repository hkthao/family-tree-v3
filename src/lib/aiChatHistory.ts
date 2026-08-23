import type { ChatTurn } from "./queries/aiChat";

/**
 * Lịch sử trò chuyện với trợ lý, lưu trên máy người dùng.
 *
 * GĐ 1 lưu ở `localStorage`. Kế hoạch (docs/plan-ai-tro-ly.md §Hội thoại
 * lưu ở đâu) là chuyển sang server ở GĐ 2 để đồng bộ giữa máy tính và
 * điện thoại — lúc đó chỗ này thành **cache** để vẽ ngay, còn nguồn sự
 * thật là bảng `ai_messages`. API dưới đây giữ nguyên khi đổi.
 *
 * Hai điều quan trọng:
 *
 * 1. **Lưu 40 tin ≠ gửi 40 tin cho model.** Đây chỉ là phần để hiển thị.
 *    Ngữ cảnh gửi lên bị cắt còn `CONTEXT_TURNS` ở `queries/aiChat.ts`;
 *    gửi cả 40 tin sẽ làm token đầu vào phình lên nhiều lần.
 *
 * 2. **Máy dùng chung.** Người lớn tuổi hay dùng chung máy tính bảng với
 *    con cháu, mà localStorage không tự mất. `clearAll()` được gọi khi
 *    đăng xuất, và người dùng có nút xoá thấy được ngay trong khung chat.
 */

const PREFIX = "family-tree:ai-chat:";
const VERSION = 1;

/** Số tin giữ lại để hiển thị. */
export const HISTORY_LIMIT = 40;
/** Chặn một lần dán mô tả gia phả dài chiếm hết localStorage. */
const MAX_BYTES = 100_000;

interface Stored {
  v: number;
  messages: ChatTurn[];
}

const keyFor = (clanId: string) => `${PREFIX}${clanId}`;

export function load(clanId: string): ChatTurn[] {
  try {
    const raw = localStorage.getItem(keyFor(clanId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    // Khác phiên bản thì bỏ, đừng cố suy diễn shape cũ.
    if (parsed?.v !== VERSION || !Array.isArray(parsed.messages)) return [];
    return parsed.messages.filter(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

export function save(clanId: string, messages: ChatTurn[]): void {
  try {
    let kept = messages.slice(-HISTORY_LIMIT);
    let payload = JSON.stringify({ v: VERSION, messages: kept } satisfies Stored);
    // Cắt dần từ đầu cho tới khi vừa hạn mức dung lượng.
    while (payload.length > MAX_BYTES && kept.length > 1) {
      kept = kept.slice(Math.ceil(kept.length / 4));
      payload = JSON.stringify({ v: VERSION, messages: kept } satisfies Stored);
    }
    localStorage.setItem(keyFor(clanId), payload);
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lịch sử hiển thị thì chấp
    // nhận được, không được để vỡ cuộc trò chuyện đang diễn ra.
  }
}

export function clear(clanId: string): void {
  try {
    localStorage.removeItem(keyFor(clanId));
  } catch {
    /* bỏ qua */
  }
}

/**
 * Xoá lịch sử của MỌI dòng họ. Gọi khi đăng xuất — máy dùng chung không
 * được để lộ câu hỏi của người trước.
 */
export function clearAll(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* bỏ qua */
  }
}
