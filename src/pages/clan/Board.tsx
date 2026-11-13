import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Chip, type ChipTone } from "@/components/Chip";
import { formatRelative } from "@/components/ClanPostCard";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { IconTile } from "@/components/IconTile";
import {
  IconAward,
  IconBell,
  IconBellOff,
  IconCalendar,
  IconClock,
  IconFlame,
  IconScroll,
  IconSearch,
  IconSparkles,
  IconTag,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { PanelLink } from "@/components/panel/PanelLink";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { LIST_PAGE_SIZE_OPTIONS, useSearchBox } from "@/hooks/useClientPaging";
import { useUrlPatch, useUrlState } from "@/hooks/useUrlState";
import {
  listClanPosts,
  listPendingPosts,
  type ClanPost,
  type ClanPostType,
} from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
const DEFAULT_PAGE_SIZE = 20;

const TYPE_LABEL: Record<ClanPostType, string> = lazyMessages({
  news: "Tin",
  event: msg`Sự kiện`,
  birth: "Sinh",
  death: msg`Cáo phó`,
  notice: msg`Thông báo`,
}) as Record<ClanPostType, string>;

/** Icon + màu theo loại bài — dùng chung cho ô icon và chip của dòng. */
const TYPE_STYLE: Record<
  ClanPostType,
  { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }
> = {
  news: { tone: "info", icon: IconScroll },
  event: { tone: "primary", icon: IconCalendar },
  birth: { tone: "success", icon: IconSparkles },
  death: { tone: "warning", icon: IconFlame },
  notice: { tone: "teal", icon: IconBell },
};

const TYPES = Object.keys(TYPE_LABEL) as ClanPostType[];

/**
 * `/clans/:clanId/board` — bảng tin dòng họ, kiểu Danh bạ: tìm kiếm + phễu (loại bài trong ngăn
 * kéo), danh sách chia vạch, phân trang phía máy chủ. Bấm một bài mở ngăn kéo xem (chỉ đọc);
 * bình luận và duyệt bài ở trang bài viết.
 */
export default function Board() {
  const { clanId } = useParams<{ clanId: string }>();
  const { user } = useAuth();
  const { clan } = useClanContext();
  const admin = isClanAdmin(clan);

  const patch = useUrlPatch();
  const { q, text, setText } = useSearchBox();
  const [typeRaw] = useUrlState("loai", "");
  const type = (TYPES as string[]).includes(typeRaw)
    ? (typeRaw as ClanPostType)
    : "";
  const [pageRaw] = useUrlState("trang", "");
  const page = Math.max(1, Number(pageRaw) || 1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const postsQ = useQuery({
    queryKey: [...queryKeys.clanPosts(clanId!), page, pageSize, type, q],
    queryFn: () =>
      listClanPosts(clanId!, { page, pageSize, type: type || null, search: q }),
    enabled: !!clanId,
    staleTime: 30_000,
  });

  // Admin: đếm số pending → hiển badge link sang queue.
  const pendingQ = useQuery({
    queryKey: queryKeys.clanPostsPending(clanId!),
    queryFn: () => listPendingPosts(clanId!),
    enabled: !!clanId && admin,
    staleTime: 30_000,
  });

  const isMember = clan.myRole !== null || clan.isPlatformAdmin;
  const total = postsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rows = postsQ.data?.rows ?? [];
  const filtering = !!q || !!type;

  function goToPage(next: number) {
    if (next < 1 || next > totalPages) return;
    patch({ trang: next === 1 ? null : String(next) });
  }

  return (
    <div className="space-y-3">
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title={t`Bảng tin`}
        description={t`Tin tức, sự kiện, sinh, mất, thông báo — cho cả họ cùng đọc.`}
        actionsBelow
        actions={
          <>
            {admin && (pendingQ.data?.length ?? 0) > 0 && (
              <Link
                to={`/clans/${clanId}/board/moderation`}
                className="h-10 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                ⏳ {pendingQ.data!.length} chờ duyệt
              </Link>
            )}
            {isMember && user && (
              <Fab
                to={`/clans/${clanId}/board/new`}
                panel={{ id: "board-new" }}
                label={t`Đăng bài mới`}
              />
            )}
          </>
        }
      />

      {!isMember && (
        <Alert>
          <AlertDescription>
            <Trans>
              <Trans>
                <Trans>
                  Bạn đang xem dưới dạng khách. Tham gia dòng họ để đăng bài và
                  bình luận.
                </Trans>
              </Trans>
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      {/* Loại bài nằm trong ngăn kéo của phễu — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={type ? 1 : 0}
        onReset={() => patch({ loai: null, trang: null })}
        title={t`Lọc bài viết`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm bài viết`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t`Tìm theo tiêu đề / nội dung…`}
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={type}
            onChange={(e) =>
              patch({ loai: e.target.value || null, trang: null })
            }
            aria-label={t`Lọc theo loại bài`}
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">{t`Mọi loại`}</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      {postsQ.isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}
      {postsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(postsQ.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {total === 0 && !postsQ.isLoading && !postsQ.error && (
        <EmptyState
          icon={
            filtering ? (
              <IconSearch className="h-10 w-10" />
            ) : (
              <IconScroll className="h-10 w-10" />
            )
          }
          title={filtering ? t`Không có bài nào khớp` : t`Chưa có bài viết nào`}
          description={
            filtering
              ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.`
              : isMember
                ? t`Hãy là người đầu tiên đăng tin cho cả họ — bấm nút '+'.`
                : t`Chưa có bài viết nào trong bảng tin.`
          }
        />
      )}

      {rows.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {rows.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              clanId={clan.id}
              isAuthor={post.author_id === user?.id}
              admin={admin}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        unit={t`bài`}
        isFetching={postsQ.isFetching}
        onPageChange={goToPage}
        pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
        onPageSizeChange={(n) => {
          setPageSize(n);
          goToPage(1);
        }}
      />
    </div>
  );
}

function PostRow({
  post,
  clanId,
  isAuthor,
  admin,
}: {
  post: ClanPost;
  clanId: string;
  isAuthor: boolean;
  admin: boolean;
}) {
  const style = TYPE_STYLE[post.type];
  const TypeIcon = style.icon;
  const isPending = post.status === "pending";
  const isHidden = post.status === "hidden";
  return (
    <li className={isHidden ? "opacity-60" : ""}>
      <PanelLink
        to={`/clans/${clanId}/board/${post.id}`}
        panel="board-view"
        panelParams={{ pid: post.id }}
        className="flex items-stretch gap-3 p-3 transition-colors hover:bg-muted/40"
      >
        <IconTile icon={TypeIcon} tone={style.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{post.title || post.body}</p>
          {post.title && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {post.body}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            {formatRelative(post.created_at)}
            {(isAuthor || admin) &&
              t` · ${isAuthor ? t`bạn` : post.author_id.slice(0, 8)}`}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {post.pinned && (
              <Chip tone="primary" icon={<IconAward />}>
                {t`Đã ghim`}
              </Chip>
            )}
            {isPending && (
              <Chip tone="warning" icon={<IconClock />}>
                {t`Chờ duyệt`}
              </Chip>
            )}
            {isHidden && (
              <Chip tone="neutral" icon={<IconBellOff />}>
                {t`Đã ẩn`}
              </Chip>
            )}
            <Chip tone={style.tone} icon={<TypeIcon />}>
              {TYPE_LABEL[post.type]}
            </Chip>
          </div>
        </div>
      </PanelLink>
    </li>
  );
}
