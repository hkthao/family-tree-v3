/**
 * Dòng thời gian một đời người: dựng tạm từ các ý "Năm Bính Tuất (1226): …"
 * trong tiểu sử khi chưa có mốc nào lưu trong DB (bảng person_timeline).
 */
import type { TimelineRow } from "@/lib/queries/person-timeline";

/** Lấy năm từ ngày "YYYY-MM-DD" / "YYYY"; không có → null. */
export function yearOf(d: string | null | undefined): number | null {
  const y = d ? Number(d.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** Mốc dựng tạm từ tiểu sử: chỉ giữ các năm trong đời người (sinh → mất). */
export function bioTimelineRows(
  bio: string | null | undefined,
  birthYear: number | null,
  deathYear: number | null,
): TimelineRow[] {
  if (!bio) return [];
  const out: TimelineRow[] = [];
  for (const line of bio.split("\n")) {
    const m = /^[-•]\s+Năm\s+([^:()]*?)\s*\((\d{3,4})\)[^:]*:\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const year = Number(m[2]);
    if ((birthYear != null && year < birthYear) || (deathYear != null && year > deathYear)) continue;
    out.push({ year, era: m[1] || null, body: m[3] });
  }
  return out;
}
