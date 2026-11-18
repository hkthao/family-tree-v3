import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AnnouncementPanel } from "@/components/AnnouncementPanel";
import { AppHeader } from "@/components/AppHeader";
import { FeedRow, TONE_TEXT } from "@/components/FeedRow";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import {
  IconBell,
  IconCheck,
  IconClock,
  IconGlobe,
  IconSearch,
  IconTag,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
} from "@/hooks/useClientPaging";
import {
  announcementsMarkAllRead,
  listAnnouncements,
  listMyAnnouncementReads,
  markAnnouncementRead,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { LEVEL_LABEL, formatRelative } from "@/lib/announcementFormat";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";
const LEVEL_TONE: Record<AnnouncementLevel, ChipTone> = {
  info: "info",
  update: "primary",
  warning: "warning",
  critical: "danger",
};

const LEVELS = Object.keys(LEVEL_LABEL) as AnnouncementLevel[];

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

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<AnnouncementLevel | "">("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [viewing, setViewing] = useState<Announcement | null>(null);
  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return rows.filter(
      (r) =>
        (!levelFilter || r.level === levelFilter) &&
        (!unreadOnly || !reads.has(r.id)) &&
        (!q || unaccent(`${r.title} ${r.body}`).toLowerCase().includes(q)),
    );
  }, [rows, search, levelFilter, unreadOnly, reads]);
  const paging = useClientPaging(filtered, 20);
  const filtering = !!search.trim() || !!levelFilter || unreadOnly;

  return (
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)] lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: t`Dòng họ`, to: "/clans" },
            { label: t`Thông báo hệ thống` },
          ]}
        />

        <PageHeader
          icon={<IconBell className="h-7 w-7" />}
          title={t`Thông báo hệ thống`}
          description={t`Tính năng mới, bảo trì, sửa lỗi quan trọng.`}
        />

        {/* Mức độ, "chỉ chưa đọc" và Đánh dấu tất cả nằm trong ngăn kéo Tuỳ chọn — đầu trang chỉ còn tiêu đề (hết rớt dòng). */}
        <CollapsibleFilters
          activeCount={(levelFilter ? 1 : 0) + (unreadOnly ? 1 : 0)}
          onReset={() => {
            setLevelFilter("");
            setUnreadOnly(false);
            paging.patchAndResetPage({});
          }}
          title={t`Lọc thông báo`}
          search={(toggle) => (
            <SearchInput
              label={t`Tìm thông báo`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                paging.patchAndResetPage({});
              }}
              placeholder={t`Tìm theo tiêu đề / nội dung…`}
              rightSlot={toggle}
            />
          )}
        >
          <div className="flex flex-col gap-3">
            <Select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value as AnnouncementLevel | "");
                paging.patchAndResetPage({});
              }}
              aria-label={t`Lọc theo mức độ`}
              icon={<IconTag />}
              className="h-11 w-full text-base"
            >
              <option value="">{t`Mọi mức độ`}</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </Select>
            {user && (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => {
                    setUnreadOnly(e.target.checked);
                    paging.patchAndResetPage({});
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">{t`Chỉ chưa đọc`}</span>
                  <span className="block text-sm text-muted-foreground">{t`Ẩn các thông báo bạn đã đọc.`}</span>
                </span>
              </label>
            )}
          </div>
          {user && unreadCount > 0 && (
            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => markAllM.mutate()}
                disabled={markAllM.isPending}
              >
                <IconCheck className="mr-1.5 h-4 w-4" />
                {markAllM.isPending
                  ? t`Đang lưu…`
                  : t`Đánh dấu tất cả đã đọc (${unreadCount})`}
              </Button>
            </div>
          )}
        </CollapsibleFilters>

        {listQ.isLoading && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-muted-foreground">{t`Đang tải…`}</p>
          </div>
        )}
        {listQ.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {(listQ.error as Error).message}
            </AlertDescription>
          </Alert>
        )}
        {!listQ.isLoading && filtered.length === 0 && (
          <EmptyState
            icon={
              filtering ? (
                <IconSearch className="h-10 w-10" />
              ) : (
                <IconBell className="h-10 w-10" />
              )
            }
            title={
              filtering
                ? t`Không có thông báo nào khớp`
                : t`Chưa có thông báo nào`
            }
            description={
              filtering ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.` : undefined
            }
          />
        )}

        {filtered.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {paging.paged.map((row) => (
              <AnnouncementRow
                key={row.id}
                row={row}
                isRead={reads.has(row.id)}
                onOpen={() => setViewing(row)}
              />
            ))}
          </ul>
        )}

        <AnnouncementPanel row={viewing} onClose={() => setViewing(null)} />

        {filtered.length > 0 && (
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={paging.pageSize}
            unit={t`thông báo`}
            onPageChange={paging.setPage}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageSizeChange={paging.setPageSize}
          />
        )}
      </main>
    </div>
  );
}

/** Bấm một dòng: đánh dấu đã đọc (nếu chưa) rồi mở ngăn kéo xem trọn tin (kiểu ngăn kéo Thông báo). */
function AnnouncementRow({
  row,
  isRead,
  onOpen,
}: {
  row: Announcement;
  isRead: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const markM = useMutation({
    mutationFn: () => markAnnouncementRead(row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
      qc.invalidateQueries({ queryKey: queryKeys.announcementsUnreadCount() });
    },
  });
  const tone = LEVEL_TONE[row.level];
  return (
    <FeedRow
      icon={IconBell}
      iconClass={TONE_TEXT[tone]}
      title={row.title}
      body={row.body}
      muted={isRead}
      onClick={() => {
        if (!isRead && !markM.isPending) markM.mutate();
        onOpen();
      }}
      chips={
        <>
          {row.is_public && (
            <Chip tone="primary" icon={<IconGlobe />}>
              Public
            </Chip>
          )}
          {!isRead && (
            <Chip tone="warning" icon={<IconCheck />}>
              {t`Chưa đọc`}
            </Chip>
          )}
          <Chip tone={tone} icon={<IconBell />}>
            {LEVEL_LABEL[row.level]}
          </Chip>
          {row.published_at && (
            <Chip tone="neutral" icon={<IconClock />}>
              <time dateTime={row.published_at}>
                {formatRelative(row.published_at)}
              </time>
            </Chip>
          )}
        </>
      }
    />
  );
}
