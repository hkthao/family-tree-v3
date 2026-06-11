import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppHeader } from "@/components/AppHeader";
import { BackLink } from "@/components/BackLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  announcementsMarkAllRead,
  listAnnouncements,
  listMyAnnouncementReads,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";

/**
 * `/announcements` — danh sách thông báo hệ thống cho mọi user đã
 * đăng nhập. Anon vào sẽ thấy danh sách rỗng (RLS lọc).
 *
 * Trang admin riêng (CRUD) ở §32.7 — trong tab Admin.tsx (xem
 * AnnouncementsAdminTab).
 */
const LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: "Tin",
  update: "Cập nhật",
  warning: "Cảnh báo",
  critical: "Quan trọng",
};

const LEVEL_BADGE: Record<AnnouncementLevel, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  update: "bg-primary/10 text-primary border-primary/30",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critical:
    "bg-destructive/10 text-destructive border-destructive/30 font-semibold",
};

export default function Announcements() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => listAnnouncements(),
    staleTime: 60_000,
  });

  const readsQ = useQuery({
    queryKey: queryKeys.announcementReads(),
    queryFn: () => listMyAnnouncementReads(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const markAllM = useMutation({
    mutationFn: () => announcementsMarkAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
      qc.invalidateQueries({
        queryKey: queryKeys.announcementsUnreadCount(),
      });
    },
  });

  const reads = readsQ.data ?? new Set<string>();
  const rows = listQ.data ?? [];
  const unreadCount = rows.filter((r) => !reads.has(r.id)).length;

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4 space-y-6">
        <nav>
          <BackLink fallback="/clans" />
        </nav>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <header className="space-y-1 flex-1 min-w-0">
            <h1 className="clan-name text-2xl sm:text-3xl font-semibold">
              Thông báo hệ thống
            </h1>
            <p className="text-muted-foreground text-sm">
              Tính năng mới, bảo trì, sửa lỗi quan trọng.
            </p>
          </header>
          {user && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllM.mutate()}
              disabled={markAllM.isPending}
            >
              {markAllM.isPending
                ? "Đang lưu…"
                : `Đánh dấu tất cả (${unreadCount})`}
            </Button>
          )}
        </div>

        {listQ.isLoading && (
          <p className="text-muted-foreground">Đang tải…</p>
        )}
        {listQ.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {(listQ.error as Error).message}
            </AlertDescription>
          </Alert>
        )}
        {!listQ.isLoading && rows.length === 0 && (
          <p className="text-muted-foreground italic">
            Chưa có thông báo nào.
          </p>
        )}

        <ul className="space-y-3">
          {rows.map((row) => (
            <AnnouncementCard
              key={row.id}
              row={row}
              isRead={reads.has(row.id)}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

function AnnouncementCard({
  row,
  isRead,
}: {
  row: Announcement;
  isRead: boolean;
}) {
  return (
    <li
      className={`rounded-lg border bg-card p-4 space-y-2 ${
        isRead ? "opacity-75" : "border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${LEVEL_BADGE[row.level]}`}
        >
          {LEVEL_LABEL[row.level]}
        </span>
        {!isRead && (
          <span className="text-xs text-primary font-medium">● Chưa đọc</span>
        )}
        {row.published_at && (
          <time
            className="text-xs text-muted-foreground ml-auto tabular-nums"
            dateTime={row.published_at}
          >
            {new Date(row.published_at).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
      <h2 className="font-semibold text-base">{row.title}</h2>
      <p className="text-sm whitespace-pre-line leading-relaxed">{row.body}</p>
    </li>
  );
}
