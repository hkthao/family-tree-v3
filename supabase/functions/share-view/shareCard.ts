import { postExcerpt } from "../_shared/vendor/postMarkdown.ts";

/**
 * Ảnh + mô tả chia sẻ admin đã thiết kế cho trang chủ dòng họ (clans.share_og_path). Chưa thiết kế (hoặc thiếu gốc URL ảnh) → undefined
 * để trang giữ thẻ og chung của ứng dụng, không lộ gì thêm. Dùng cho trình duyệt thật / công cụ xem trước chạy JS đọc thẻ og sau khi trang dựng.
 */
// deno-lint-ignore no-explicit-any
export function buildShareCard(clanRow: any, imageBase: string | null | undefined): { image: string; description: string | null } | undefined {
  const path = (clanRow?.share_og_path as string | null) ?? null;
  if (!path || !imageBase) return undefined;
  const ts = clanRow?.share_og_updated_at ? Date.parse(clanRow.share_og_updated_at as string) : NaN;
  const v = Number.isFinite(ts) ? `?v=${ts}` : "";
  const desc = postExcerpt((clanRow?.description as string | null) ?? "", 200);
  return { image: `${imageBase.replace(/\/+$/, "")}/${path}${v}`, description: desc || null };
}
