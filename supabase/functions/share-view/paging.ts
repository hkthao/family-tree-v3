/**
 * Đọc TOÀN BỘ hàng của một truy vấn lớn bằng cách phân trang.
 *
 * PostgREST cắt âm thầm ở `max_rows` (mặc định 1000): dòng họ đông hơn 1000 người / gia đình sẽ bị mất người ở cây chia sẻ mà không có
 * lỗi nào. Hàm này lặp theo từng trang (nên truy vấn phải có `.order(...)` ổn định) cho tới khi hết dữ liệu; `maxRows` là chốt an toàn
 * để một dòng họ khổng lồ không làm cạn bộ nhớ của function. Không import Deno-only nên test được bằng vitest.
 */

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export const PAGE_SIZE = 1000;
export const MAX_ROWS = 50_000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<{
  data: T[];
  error: { message: string } | null;
  truncated: boolean;
}> {
  const size = opts.pageSize ?? PAGE_SIZE;
  const max = opts.maxRows ?? MAX_ROWS;
  const rows: T[] = [];
  for (let from = 0; from < max; from += size) {
    const r = await page(from, from + size - 1);
    if (r.error) return { data: rows, error: r.error, truncated: false };
    const got = r.data ?? [];
    rows.push(...got);
    // Trang ngắn = hết dữ liệu. (Nếu máy chủ cắt trang nhỏ hơn `size` do max_rows thấp hơn, vẫn đúng khi max_rows >= size.)
    if (got.length < size) return { data: rows, error: null, truncated: false };
  }
  return { data: rows.slice(0, max), error: null, truncated: true };
}
