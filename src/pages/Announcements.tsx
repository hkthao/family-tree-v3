import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  IconBell,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  announcementsMarkAllRead,
  listAnnouncements,
  listMyAnnouncementReads,
  markAnnouncementRead,
  type Announcement,
} from "@/lib/queries/announcements";
import {
  LEVEL_ACCENT,
  LEVEL_BADGE,
  LEVEL_LABEL,
  formatRelative,
} from "@/lib/announcementFormat";
import { queryKeys } from "@/lib/queries/keys";

/**
 * `/announcements` — danh sách thông báo hệ thống cho mọi user đã
 * đăng nhập. Anon vào sẽ thấy danh sách rỗng (RLS lọc).
 *
 * Trang admin riêng (CRUD) ở §32.7 — trong tab Admin.tsx (xem
 * AnnouncementsAdminTab).
 */
export default function Announcements() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Khi user vào trang thông báo, luôn fetch fresh — list ngắn nên
  // tốn ít. staleTime ngắn để tránh persisted cache cũ.
  const listQ = useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => listAnnouncements(),
    staleTime: 10_000,
    refetchOnMount: "always",
  });

  const readsQ = useQuery({
    queryKey: queryKeys.announcementReads(),
    queryFn: () => listMyAnnouncementReads(),
    enabled: !!user,
    staleTime: 10_000,
    refetchOnMount: "always",
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
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: "Dòng họ", to: "/clans" },
            { label: "Thông báo hệ thống" },
          ]}
        />

        <PageHeader
          icon={<IconBell className="h-7 w-7" />}
          title="Thông báo hệ thống"
          description="Tính năng mới, bảo trì, sửa lỗi quan trọng."
          actions={
            user && unreadCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => markAllM.mutate()}
                disabled={markAllM.isPending}
              >
                <IconCheck className="h-4 w-4 mr-1.5" />
                {markAllM.isPending
                  ? "Đang lưu…"
                  : `Đánh dấu tất cả (${unreadCount})`}
              </Button>
            ) : undefined
          }
        />

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
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  // Body dài (nhiều dòng hoặc > ~160 ký tự) thì cho thu gọn; ngắn thì
  // hiện nguyên, không cần nút.
  const isLong = row.body.length > 160 || row.body.includes("\n");

  const markM = useMutation({
    mutationFn: () => markAnnouncementRead(row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
      qc.invalidateQueries({ queryKey: queryKeys.announcementsUnreadCount() });
    },
  });

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    // Mở rộng = đã xem → tự đánh dấu đã đọc.
    if (next && !isRead && !markM.isPending) markM.mutate();
  }

  return (
    <li
      className={`relative overflow-hidden rounded-lg border bg-card shadow-sm transition-colors ${
        isRead ? "opacity-80" : ""
      }`}
    >
      {/* Dải accent màu theo level ở mép trái — chỉ hiện khi chưa đọc. */}
      {!isRead && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 bottom-0 w-1 ${LEVEL_ACCENT[row.level]}`}
        />
      )}

      <div className="px-5 py-3 space-y-1.5">
        <button
          type="button"
          onClick={isLong ? toggle : undefined}
          aria-expanded={isLong ? expanded : undefined}
          className={`block w-full text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isLong ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <h3
            className={`text-lg leading-snug ${
              isRead ? "font-medium text-foreground/80" : "font-semibold"
            }`}
          >
            {row.title}
          </h3>
        </button>

        <p
          className={`text-sm leading-relaxed text-muted-foreground ${
            expanded || !isLong
              ? "whitespace-pre-line"
              : "line-clamp-2"
          }`}
        >
          {row.body}
        </p>

        {isLong && (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {expanded ? (
              <>
                <IconChevronUp className="h-4 w-4" />
                Thu gọn
              </>
            ) : (
              <>
                <IconChevronDown className="h-4 w-4" />
                Xem thêm
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
          {row.published_at && (
            <time
              className="text-muted-foreground tabular-nums"
              dateTime={row.published_at}
              title={new Date(row.published_at).toLocaleString("vi-VN")}
            >
              {formatRelative(row.published_at)}
            </time>
          )}
          {row.is_public && (
            <span className="text-muted-foreground">· Public</span>
          )}
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${LEVEL_BADGE[row.level]}`}
          >
            {LEVEL_LABEL[row.level]}
          </span>

          {/* Đánh dấu đã đọc / trạng thái đã đọc — đẩy sang phải. */}
          <span className="ml-auto inline-flex items-center gap-3">
            {isRead ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <IconCheck className="h-3.5 w-3.5" />
                Đã đọc
              </span>
            ) : (
              <button
                type="button"
                onClick={() => markM.mutate()}
                disabled={markM.isPending}
                className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60"
              >
                <IconCheck className="h-3.5 w-3.5" />
                {markM.isPending ? "Đang lưu…" : "Đánh dấu đã đọc"}
              </button>
            )}
            <Link
              to={`/announcements/${row.id}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Chi tiết →
            </Link>
          </span>
        </div>
      </div>
    </li>
  );
}

