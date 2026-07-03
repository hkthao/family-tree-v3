import type { AnnouncementLevel } from "@/lib/queries/announcements";

/** Nhãn + màu badge/accent theo mức độ tin — dùng chung cho trang
 *  /announcements và popover chuông thông báo. */
export const LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: "Tin",
  update: "Cập nhật",
  warning: "Cảnh báo",
  critical: "Quan trọng",
};

export const LEVEL_BADGE: Record<AnnouncementLevel, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  update: "bg-primary/10 text-primary border-primary/30",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critical:
    "bg-destructive/10 text-destructive border-destructive/30 font-semibold",
};

/** Dải accent màu theo level (đậm hơn badge) — dùng làm chỉ báo chưa đọc. */
export const LEVEL_ACCENT: Record<AnnouncementLevel, string> = {
  info: "bg-blue-500/60",
  update: "bg-primary/80",
  warning: "bg-amber-500/70",
  critical: "bg-destructive",
};

/**
 * Thời gian dạng "relative" ngắn gọn: "vừa xong", "10 phút trước",
 * "3 giờ trước", "Hôm qua", "5 ngày trước" — sau 7 ngày về dd/MM/yyyy.
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDay === 1) return "Hôm qua";
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
