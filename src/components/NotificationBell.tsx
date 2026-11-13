import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { IconBell, IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PanelActionBar } from "@/components/ui/form-actions";
import { usePanel } from "@/components/panel/usePanel";
import { SidePanel } from "@/components/SidePanel";
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
import {
  inboxUnreadCount,
  listMyInbox,
  markAllInboxRead,
  markInboxRead,
} from "@/lib/queries/notifications";
import { mergeFeed, unreadTotal } from "@/lib/notificationFeed";
import { queryKeys } from "@/lib/queries/keys";
import { useAuth } from "@/hooks/useAuth";

import { t } from "@lingui/core/macro";
/**
 * Chuông thông báo ở header. Click → ngăn kéo bên phải (`?panel=notifications`,
 * Back đóng được): lọc Tất cả / Chưa đọc, "đánh dấu tất cả", chấm xanh = chưa
 * đọc, badge mức độ, thời gian tương đối. Thông báo hệ thống bấm là mở rộng nội
 * dung ngay trong panel (không rời trang); tin hộp thư riêng có đường dẫn thì
 * đi tới đó. Badge số chưa đọc vẫn poll nền 60s. Ẩn khi chưa đăng nhập.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { current, open: openPanel, close: closePanel } = usePanel();
  const open = current === "notifications";
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: annUnread = 0 } = useQuery({
    queryKey: queryKeys.announcementsUnreadCount(),
    queryFn: () => announcementsUnreadCount(),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  // Hộp thư riêng: nhắc giỗ, đóng góp, thông gia, bản tin tuần — đúng
  // những gì đã gửi qua email cho chính người này. Trước đây chỉ nằm
  // trong hộp thư email; mail rơi vào thư rác là mất luôn.
  const { data: inboxUnread = 0 } = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: inboxUnreadCount,
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const count = unreadTotal(annUnread, inboxUnread);

  // Chỉ tải danh sách + trạng thái đọc khi mở popover.
  const listQ = useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => listAnnouncements(),
    enabled: !!user && open,
    staleTime: 30_000,
  });
  const inboxQ = useQuery({
    queryKey: ["inbox-list"],
    queryFn: () => listMyInbox(50),
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
    // Cả hai nguồn: người dùng bấm "đánh dấu tất cả" là muốn cái chấm đỏ
    // biến mất, không quan tâm tin đến từ bảng nào.
    mutationFn: async () => {
      await Promise.all([announcementsMarkAllRead(), markAllInboxRead()]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
      qc.invalidateQueries({ queryKey: queryKeys.announcementsUnreadCount() });
      qc.invalidateQueries({ queryKey: ["inbox-unread"] });
      qc.invalidateQueries({ queryKey: ["inbox-list"] });
    },
  });

  if (!user) return null;

  const reads = readsQ.data ?? new Set<string>();
  const allRows = mergeFeed(listQ.data ?? [], reads, inboxQ.data ?? []);
  const rows = (
    filter === "unread" ? allRows.filter((r) => !r.read) : allRows
  ).slice(0, 50);

  const markRead = (row: (typeof rows)[number]) => {
    if (row.read) return;
    const mark =
      row.kind === "announcement"
        ? markAnnouncementRead(row.id)
        : markInboxRead(row.id);
    mark
      .then(() => {
        qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
        qc.invalidateQueries({
          queryKey: queryKeys.announcementsUnreadCount(),
        });
        qc.invalidateQueries({ queryKey: ["inbox-unread"] });
        qc.invalidateQueries({ queryKey: ["inbox-list"] });
      })
      .catch(() => {});
  };

  // Đi sang trang khác từ panel: nếu panel do app mở (đã đẩy 1 history entry)
  // thì THAY entry đó, để Back từ trang đích về trang cũ chứ không mở lại panel.
  const go = (to: string) => {
    const pushed = (location.state as { panelOpened?: boolean } | null)
      ?.panelOpened;
    navigate(to, { replace: !!pushed });
  };

  const openItem = (row: (typeof rows)[number]) => {
    markRead(row);
    if (row.kind === "announcement") {
      // Mở rộng ngay trong panel, không đi sang trang khác.
      setExpanded((k) => (k === row.key ? null : row.key));
      return;
    }
    go(row.url ?? "/announcements");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel("notifications"))}
        aria-label={
          count > 0 ? t`${count} thông báo chưa đọc` : "Thông báo hệ thống"
        }
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

      <SidePanel
        open={open}
        title={t`Thông báo`}
        subtitle={count > 0 ? t`${count} chưa đọc` : "Bạn đã đọc hết"}
        onClose={closePanel}
      >
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 pb-3">
            <div
              className="flex gap-1.5"
              role="group"
              aria-label={t`Lọc thông báo`}
            >
              {(
                [
                  ["all", "Tất cả"],
                  ["unread", "Chưa đọc"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filter === v}
                  onClick={() => setFilter(v)}
                  className={
                    filter === v
                      ? "rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground"
                      : "rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(listQ.isLoading || inboxQ.isLoading) && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t`Đang tải…`}
            </p>
          )}
          {!listQ.isLoading && rows.length === 0 && (
            <div className="py-10 text-center">
              <IconBell className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                {filter === "unread"
                  ? t`Không còn thông báo chưa đọc.`
                  : t`Chưa có thông báo nào.`}
              </p>
            </div>
          )}
          {rows.length > 0 && (
            <ul className="-mx-4 divide-y border-t sm:-mx-5">
              {rows.map((row) => {
                const isRead = row.read;
                const isOpen = expanded === row.key;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => openItem(row)}
                      aria-expanded={
                        row.kind === "announcement" ? isOpen : undefined
                      }
                      className={`flex w-full gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/60 sm:px-5 ${
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
                            className={`min-w-0 flex-1 text-sm leading-snug ${
                              isOpen ? "" : "line-clamp-2"
                            } ${isRead ? "font-medium text-foreground/80" : "font-semibold"}`}
                          >
                            {row.title}
                          </span>
                          {row.level && (
                            <span
                              className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_BADGE[row.level]}`}
                            >
                              {LEVEL_LABEL[row.level]}
                            </span>
                          )}
                        </span>
                        <span
                          className={`mt-1 block text-xs leading-relaxed text-muted-foreground ${
                            isOpen ? "whitespace-pre-line" : "line-clamp-2"
                          }`}
                        >
                          {row.body}
                        </span>
                        {row.at && (
                          <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                            {formatRelative(row.at)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <PanelActionBar>
            <Button
              type="button"
              variant="outline"
              onClick={() => markAllM.mutate()}
              disabled={count === 0 || markAllM.isPending}
            >
              <IconCheck className="h-4 w-4 mr-1.5" />
              {markAllM.isPending ? t`Đang lưu…` : t`Đánh dấu đã đọc`}
            </Button>
            <Button type="button" onClick={() => go("/announcements")}>
              {t`Xem tất cả`}
            </Button>
          </PanelActionBar>
        </div>
      </SidePanel>
    </>
  );
}
