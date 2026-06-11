import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { announcementsUnreadCount } from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";
import { useAuth } from "@/hooks/useAuth";

/**
 * Chuông thông báo ở header — gọi `announcements_unread_count()`.
 * Badge chỉ hiện khi > 0. Click → `/announcements`.
 *
 * Ẩn khi chưa đăng nhập (anon vào trang public không có khái niệm
 * "tin chưa đọc").
 */
export function NotificationBell() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: queryKeys.announcementsUnreadCount(),
    queryFn: () => announcementsUnreadCount(),
    enabled: !!user,
    // Poll 60s — Realtime là gợi ý §32.9 O1, để optimize sau.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!user) return null;

  return (
    <Link
      to="/announcements"
      aria-label={
        count > 0
          ? `${count} thông báo chưa đọc`
          : "Thông báo hệ thống"
      }
      title={
        count > 0
          ? `${count} thông báo chưa đọc`
          : "Thông báo hệ thống"
      }
      className="relative h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold min-w-[18px] h-[18px] px-1 leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
