/**
 * Đổi dữ liệu video của Facebook thành bản ghi tập podcast.
 *
 * Tách riêng khỏi index.ts để test được bằng vitest: index.ts gọi
 * `Deno.serve` ngay khi nạp, nên không import vào test chạy bằng Node được.
 */

export interface FbVideo {
  id: string;
  description?: string;
  created_time: string;
  permalink_url?: string;
  picture?: string;
  length?: number;
}

export interface EpisodeRow {
  fb_video_id: string;
  title: string;
  description: string | null;
  permalink_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string;
}

/**
 * Tiêu đề rút từ dòng đầu của phần mô tả.
 *
 * Mô tả reel thường là: câu mở đầu → xuống dòng → nội dung → một rừng
 * hashtag. Dòng đầu gần như luôn là câu hỏi hoặc ý chính, tức đúng thứ
 * làm tiêu đề. Bỏ qua dòng chỉ có hashtag. Không còn gì dùng được thì lùi
 * về ngày đăng — thà "Tập ngày 13/09/2026" còn hơn một dòng trống.
 */
export function titleFromDescription(
  description: string | undefined | null,
  publishedAt: string,
): string {
  const firstLine = (description ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#"));
  if (!firstLine) {
    const d = publishedAt;
    return `Tập ngày ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  }
  if (firstLine.length <= 120) return firstLine;
  // Cắt theo TỪ, không cắt giữa chữ — tiếng Việt cắt giữa chữ thành nghĩa khác.
  const cut = firstLine.slice(0, 120);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * Link đầy đủ. Graph API trả đường dẫn TƯƠNG ĐỐI ("/reel/123/") — nhét
 * thẳng vào thẻ nhúng là ra link hỏng.
 */
export function absoluteUrl(
  permalink: string | undefined | null,
  id: string,
): string {
  if (!permalink) return `https://www.facebook.com/${id}`;
  return permalink.startsWith("http")
    ? permalink
    : `https://www.facebook.com${permalink}`;
}

export function toEpisode(v: FbVideo): EpisodeRow {
  return {
    fb_video_id: v.id,
    title: titleFromDescription(v.description, v.created_time),
    description: v.description ?? null,
    permalink_url: absoluteUrl(v.permalink_url, v.id),
    thumbnail_url: v.picture ?? null,
    duration_seconds: typeof v.length === "number" ? v.length : null,
    published_at: v.created_time,
  };
}
