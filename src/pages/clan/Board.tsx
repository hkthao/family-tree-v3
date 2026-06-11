import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link, useParams } from "react-router-dom";

import { ClanPostCard } from "@/components/ClanPostCard";
import { IconScroll } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { listClanPosts, listPendingPosts } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

const PAGE_SIZE = 10;

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

  const postsQ = useQuery({
    queryKey: [...queryKeys.clanPosts(clanId!), page],
    queryFn: () => listClanPosts(clanId!, { page, pageSize: PAGE_SIZE }),
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function goToPage(next: number) {
    if (next < 1 || next > totalPages) return;
    const params = new URLSearchParams(searchParams);
    if (next === 1) params.delete("page");
    else params.set("page", String(next));
    setSearchParams(params);
  }

  return (
    <div className="space-y-3">
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title="Bảng tin"
        description="Tin tức, sự kiện, sinh, mất, thông báo — cho cả họ cùng đọc."
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
              <Button asChild size="sm" className="h-10">
                <Link to={`/clans/${clanId}/board/new`}>+ Đăng bài mới</Link>
              </Button>
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
        <p className="text-muted-foreground">Đang tải…</p>
      )}
      {postsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(postsQ.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {total === 0 && !postsQ.isLoading && (
        <p className="text-muted-foreground italic">
          Chưa có bài viết nào. Hãy là người đầu tiên đăng tin cho cả họ.
        </p>
      )}

      <ul className="space-y-2">
        {(postsQ.data?.rows ?? []).map((post) => (
          <li key={post.id}>
            <ClanPostCard post={post} clan={clan} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between pt-3 border-t"
          aria-label="Phân trang"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            ← Trang trước
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Trang {page} / {totalPages} · {total} bài
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Trang sau →
          </Button>
        </nav>
      )}
    </div>
  );
}
