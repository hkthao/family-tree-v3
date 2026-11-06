import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams, Link, useParams } from "react-router-dom";

import { Fab } from "@/components/Fab";
import { ClanPostCard } from "@/components/ClanPostCard";
import { EmptyState } from "@/components/EmptyState";
import { IconScroll } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { LIST_PAGE_SIZE_OPTIONS } from "@/hooks/useClientPaging";
import { listClanPosts, listPendingPosts } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

const DEFAULT_PAGE_SIZE = 20;

/**
 * `/clans/:clanId/board` — bảng tin dòng họ. Có phân trang qua
 * `?page=N`. Thêm bài → `/board/new`; xem chi tiết → `/board/:id`.
 */
export default function Board() {
  const { clanId } = useParams<{ clanId: string }>();
  const { user } = useAuth();
  const { clan } = useClanContext();
  const admin = isClanAdmin(clan);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const postsQ = useQuery({
    queryKey: [...queryKeys.clanPosts(clanId!), page, pageSize],
    queryFn: () => listClanPosts(clanId!, { page, pageSize }),
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

  function goToPage(next: number) {
    if (next < 1 || next > totalPages) return;
    const params = new URLSearchParams(searchParams);
    if (next === 1) params.delete("page");
    else params.set("page", String(next));
    // replace (not push) so paging doesn't stack history entries and
    // Back from a post detail returns to the page you were on.
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-3">
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title="Bảng tin"
        description="Tin tức, sự kiện, sinh, mất, thông báo — cho cả họ cùng đọc."
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
              <Fab to={`/clans/${clanId}/board/new`} panel={{ id: "board-new" }} label="Đăng bài mới" />
            )}
          </>
        }
      />

      {!isMember && (
        <Alert>
          <AlertDescription>
            Bạn đang xem dưới dạng khách. Tham gia dòng họ để đăng bài và
            bình luận.
          </AlertDescription>
        </Alert>
      )}

      {postsQ.isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}
      {postsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(postsQ.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {total === 0 && !postsQ.isLoading && !postsQ.error && (
        <EmptyState
          icon={<IconScroll className="h-10 w-10" />}
          title="Chưa có bài viết nào"
          description={
            isMember
              ? "Hãy là người đầu tiên đăng tin cho cả họ — bấm nút '+'."
              : "Chưa có bài viết nào trong bảng tin."
          }
        />
      )}

      <ul className="space-y-2">
        {(postsQ.data?.rows ?? []).map((post) => (
          <li key={post.id}>
            <ClanPostCard post={post} clan={clan} />
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        unit="bài"
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
