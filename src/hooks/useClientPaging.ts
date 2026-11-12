import { useEffect, useState } from "react";

import { useUrlPatch, useUrlState } from "@/hooks/useUrlState";

/** Số dòng mỗi trang cho các màn danh sách phân trang phía client (chuẩn Danh bạ). */
export const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/**
 * Phân trang phía client cho danh sách đã tải đủ về. Số trang nằm trên URL (`?trang=`)
 * để Back / chia sẻ link giữ đúng trang; số dòng mỗi trang chỉ giữ trong phiên.
 * Đổi tìm kiếm / bộ lọc (cũng nằm trên URL) thì gọi `patchAndResetPage({ q: "…" })` để ghi
 * bộ lọc và về trang đầu trong MỘT lần cập nhật URL — hai setter liền nhau sẽ ghi đè nhau.
 */
export function useClientPaging<T>(items: T[], defaultSize = 20) {
  const [pageRaw, setPageRaw] = useUrlState("trang", "");
  const patch = useUrlPatch();
  const [pageSize, setPageSizeState] = useState(defaultSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  return {
    page,
    totalPages,
    pageSize,
    total: items.length,
    paged: items.slice((page - 1) * pageSize, page * pageSize),
    setPage: (n: number) => setPageRaw(n <= 1 ? "" : String(n)),
    patchAndResetPage: (updates: Record<string, string | null>) =>
      patch({ ...updates, trang: null }),
    setPageSize: (n: number) => {
      setPageSizeState(n);
      setPageRaw("");
    },
  };
}

/**
 * Ô tìm kiếm có debounce, giá trị tìm nằm trên URL (`?q=`) để link sâu / Back giữ nguyên
 * (vd Góp ý → "Quản lý ↗" mở Người dùng đã lọc sẵn theo email). Đổi từ khoá thì về trang đầu
 * trong MỘT lần ghi URL. `text` là chữ đang gõ, `q` là từ khoá đã áp dụng.
 */
export function useSearchBox(delay = 300) {
  const patch = useUrlPatch();
  const [q] = useUrlState("q", "");
  const [text, setText] = useState(q);
  useEffect(() => {
    const h = setTimeout(() => {
      if (text !== q) patch({ q: text || null, trang: null });
    }, delay);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return { q, text, setText };
}

/**
 * Bộ lọc chọn-một nằm trên URL (vd `?loai=donation_money`) để Back / chia sẻ link giữ nguyên.
 * Đổi giá trị thì về trang đầu trong CÙNG MỘT lần ghi URL — đừng gọi thêm `patchAndResetPage` ngay
 * sau setter này (hai lần ghi liền nhau ghi đè nhau).
 */
export function useUrlFilter<T extends string>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const [raw] = useUrlState(key, defaultValue);
  const patch = useUrlPatch();
  return [raw as T, (next: T) => patch({ [key]: next === defaultValue ? null : next, trang: null })];
}
