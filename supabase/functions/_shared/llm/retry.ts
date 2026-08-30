import { LlmError } from "./types.ts";

/**
 * Có được thử lại lượt gọi vừa hỏng không.
 *
 * Tách khỏi gateway để **test được ngoài Deno**: gateway kéo theo SDK
 * Anthropic (`npm:` specifier) mà vitest không nạp nổi, còn luật ở đây
 * mới là chỗ tinh tế cần canh.
 *
 * Luật thứ hai (`emitted`) là luật của phần trả lời dần: **đã bắn chữ ra
 * màn hình rồi thì không thử lại nữa**. Lần thử sau sinh một câu trả lời
 * khác, mà chữ cũ vẫn đang nằm đó — người dùng thấy hai câu dính vào
 * nhau, tệ hơn hẳn một thông báo lỗi tử tế.
 */
export function shouldRetry(
  e: unknown,
  opts: { emitted: boolean; attempt: number; maxAttempts: number },
): boolean {
  if (opts.emitted) return false;
  if (opts.attempt >= opts.maxAttempts) return false;
  return e instanceof LlmError && e.retryable;
}
