import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { IconBell } from "@/components/icons";
import {
  announcementsMarkAllRead,
  announcementsUnreadCount,
  listAnnouncements,
  listMyAnnouncementReads,
  markAnnouncementRead,
} from "@/lib/queries/announcements";
import {
  LEVEL_BADGE,
  LEVEL_LABEL,
  formatRelative,
} from "@/lib/announcementFormat";
import { queryKeys } from "@/lib/queries/keys";
import { useAuth } from "@/hooks/useAuth";

/**
 * Chuông thông báo ở header. Click → POPOVER kiểu app hiện đại: tiêu đề
 * + "đánh dấu tất cả", danh sách vài tin gần nhất (chấm xanh = chưa đọc,
 * badge mức độ, thời gian tương đối), và "Xem tất cả". Badge số chưa đọc
 * vẫn poll nền 60s. Ẩn khi chưa đăng nhập.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: count = 0 } = useQuery({
    queryKey: queryKeys.announcementsUnreadCount(),
    queryFn: () => announcementsUnreadCount(),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Chỉ tải danh sách + trạng thái đọc khi mở popover.
  const listQ = useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => listAnnouncements(),
    enabled: !!user && open,
    staleTime: 30_000,
  });
  const readsQ = useQuery({
    queryKey: queryKeys.announcementReads(),
    queryFn: () => listMyAnnouncementReads(),
    enabled: !!user && open,
    staleTime: 30_000,
  });

  const markAllM = useMutation({
    mutationFn: () => announcementsMarkAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
      qc.invalidateQueries({ queryKey: queryKeys.announcementsUnreadCount() });
    },
  });

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const reads = readsQ.data ?? new Set<string>();
  const rows = (listQ.data ?? []).slice(0, 6);

  const openItem = (id: string, isRead: boolean) => {
    if (!isRead) {
      markAnnouncementRead(id)
        .then(() => {
          qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
          qc.invalidateQueries({
            queryKey: queryKeys.announcementsUnreadCount(),
          });
        })
        .catch(() => {});
    }
    setOpen(false);
    navigate(`/announcements/${id}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `${count} thông báo chưa đọc` : "Thông báo hệ thống"}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
      >
        <IconBell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-16 z-50 origin-top overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150 ease-out sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px] sm:max-w-[calc(100vw-24px)] sm:origin-top-right">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Thông báo</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllM.mutate()}
                disabled={markAllM.isPending}
                className="text-xs text-primary hover:underline disabled:opacity-60"
              >
                {markAllM.isPending ? "Đang lưu…" : "Đánh dấu tất cả đã đọc"}
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {listQ.isLoading && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Đang tải…
              </p>
            )}
            {!listQ.isLoading && rows.length === 0 && (
              <div className="px-4 py-10 text-center">
                <IconBell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Chưa có thông báo nào.
                </p>
              </div>
            )}
            {rows.length > 0 && (
              <ul className="divide-y">
                {rows.map((row) => {
                  const isRead = reads.has(row.id);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => openItem(row.id, isRead)}
                        className={`flex w-full gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                          isRead ? "" : "bg-primary/[0.045]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            isRead ? "bg-transparent" : "bg-primary"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span
                              className={`line-clamp-2 min-w-0 flex-1 text-sm leading-snug ${
                                isRead
                                  ? "font-medium text-foreground/80"
                                  : "font-semibold"
                              }`}
                            >
                              {row.title}
                            </span>
                            <span
                              className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_BADGE[row.level]}`}
                            >
                              {LEVEL_LABEL[row.level]}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {row.body}
                          </span>
                          {row.published_at && (
                            <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                              {formatRelative(row.published_at)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t">
            <Link
              to="/announcements"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted/60"
            >
              Xem tất cả
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
