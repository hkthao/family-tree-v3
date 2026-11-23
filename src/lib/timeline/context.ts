import { bucketOfYear } from "@/lib/timeline/computeClanTimeline";
import { erasOverlapping, type TimelineIconKey } from "@/lib/timeline/eras";

/**
 * "Bối cảnh thời đại" của một mốc (thẻ giấy ghi chú). Mặc định lấy theo năm từ thư viện thời đại; người dùng
 * có thể sửa riêng cho từng mốc. Lưu ở 2 cột `context_title` / `context_body` (mỗi dòng của body là một ý):
 *   cả hai null     → dùng mặc định theo năm
 *   cả hai rỗng ""  → ẩn thẻ bối cảnh
 *   còn lại         → nội dung tự sửa
 */
export interface MilestoneContext {
  title: string;
  bullets: string[];
  iconKey: TimelineIconKey;
}

export const MAX_BULLETS = 6;
export const MAX_BULLET_LEN = 160;
export const MAX_CONTEXT_TITLE = 200;
export const MAX_CONTEXT_BODY = 1000;
const FALLBACK_ICON: TimelineIconKey = "scroll";

export function bulletsToText(b: string[]): string {
  return b.join("\n");
}

/** Mỗi dòng một ý; bỏ dòng trống, cắt khoảng trắng, giới hạn số ý và độ dài. */
export function textToBullets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean)
    .slice(0, MAX_BULLETS)
    .map((l) => l.slice(0, MAX_BULLET_LEN));
}

/** Id thời đại (theo thư viện `eras.ts`) mà năm rơi vào; null nếu năm không hợp lệ. */
export function eraIdForYear(year: number): string | null {
  if (!Number.isInteger(year) || year < 1) return null;
  const b = bucketOfYear(year);
  return erasOverlapping(b.from, b.to)[0]?.id ?? null;
}

/** Bối cảnh mặc định theo năm (thời đại đầu tiên giao với giai đoạn của năm đó), hoặc null. */
export function defaultContext(year: number): MilestoneContext | null {
  if (!Number.isInteger(year) || year < 1) return null;
  const b = bucketOfYear(year);
  const era = erasOverlapping(b.from, b.to)[0];
  return era
    ? { title: era.title, bullets: era.bullets, iconKey: era.iconKey }
    : null;
}

/** Bối cảnh hiển thị của một mốc từ các cột đã lưu. null = không hiện thẻ. */
export function resolveContext(
  year: number,
  title: string | null,
  body: string | null,
): MilestoneContext | null {
  if (title === null && body === null) return defaultContext(year);
  if (!(title ?? "").trim() && !(body ?? "").trim()) return null; // đã ẩn
  const def = defaultContext(year);
  return {
    title: (title ?? "").trim(),
    bullets: textToBullets(body ?? ""),
    iconKey: def?.iconKey ?? FALLBACK_ICON,
  };
}

/**
 * Giá trị cần lưu từ nội dung người dùng gõ trong form:
 * trùng mặc định → null (tiếp tục theo thời đại); trống hết → "" (ẩn); khác → lưu bản tự sửa.
 */
export function contextToColumns(
  year: number,
  title: string,
  text: string,
): { context_title: string | null; context_body: string | null } {
  const t = title.trim();
  const bullets = textToBullets(text);
  if (!t && bullets.length === 0) return { context_title: "", context_body: "" };
  const def = defaultContext(year);
  if (
    def &&
    def.title === t &&
    def.bullets.length === bullets.length &&
    def.bullets.every((x, i) => x === bullets[i])
  ) {
    return { context_title: null, context_body: null };
  }
  return {
    context_title: t.slice(0, MAX_CONTEXT_TITLE),
    context_body: bulletsToText(bullets).slice(0, MAX_CONTEXT_BODY),
  };
}
