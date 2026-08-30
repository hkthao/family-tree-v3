import type { AnnouncementLevel } from "@/lib/queries/announcements";
import type { InboxItem } from "@/lib/queries/notifications";

/**
 * Gộp hai nguồn thông báo thành MỘT danh sách cho cái chuông.
 *
 *  - Thông báo nền tảng (`announcements`): admin viết, ai cũng thấy.
 *  - Hộp thư riêng (`notification_log`): đúng những gì đã gửi cho chính
 *    người này — nhắc giỗ, đóng góp chờ duyệt, thông gia, bản tin tuần.
 *
 * Vì sao gộp chứ không tách hai tab: người dùng không phân biệt "tin của
 * hệ thống" với "tin của dòng họ tôi" — với họ chỉ có "có gì mới không".
 * Bắt họ nhớ tin nằm ở tab nào là bắt họ học một thứ vô ích.
 *
 * Hàm thuần, tách khỏi component để test được phần dễ sai nhất: sắp xếp
 * và đếm chưa đọc.
 */

export interface FeedRow {
  /** Khoá React — id của hai nguồn có thể trùng nhau. */
  key: string;
  kind: "announcement" | "inbox";
  id: string;
  title: string;
  body: string | null;
  /** Mốc thời gian ISO; null khi thông báo chưa xuất bản. */
  at: string | null;
  read: boolean;
  level?: AnnouncementLevel;
  /** Đường dẫn khi bấm vào (chỉ có ở hộp thư riêng). */
  url?: string | null;
}

export interface AnnouncementLike {
  id: string;
  title: string;
  body: string | null;
  published_at: string | null;
  level: AnnouncementLevel;
}

export function mergeFeed(
  announcements: AnnouncementLike[],
  reads: Set<string>,
  inbox: InboxItem[],
): FeedRow[] {
  const rows: FeedRow[] = [
    ...announcements.map((a) => ({
      key: `ann:${a.id}`,
      kind: "announcement" as const,
      id: a.id,
      title: a.title,
      body: a.body,
      at: a.published_at,
      read: reads.has(a.id),
      level: a.level,
    })),
    ...inbox.map((n) => ({
      key: `inbox:${n.id}`,
      kind: "inbox" as const,
      id: n.id,
      title: n.title,
      body: n.body,
      at: n.sent_at,
      read: n.read_at !== null,
      url: n.url,
    })),
  ];

  // Mới nhất trước. Tin chưa có mốc thời gian (thông báo chưa xuất bản)
  // xuống cuối chứ không nhảy lên đầu — `Date.parse(null)` ra NaN và
  // NaN trong hàm so sánh làm thứ tự loạn hẳn, không chỉ sai một dòng.
  return rows.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : -Infinity;
    const tb = b.at ? Date.parse(b.at) : -Infinity;
    return tb - ta;
  });
}

/** Tổng số chưa đọc của cả hai nguồn — con số trên cái chuông. */
export function unreadTotal(
  announcementUnread: number,
  inboxUnread: number,
): number {
  return Math.max(0, announcementUnread) + Math.max(0, inboxUnread);
}
