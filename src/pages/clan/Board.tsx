import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { ClanPostCard } from "@/components/ClanPostCard";
import { ClanPostComposer } from "@/components/ClanPostComposer";
import { IconScroll } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { listClanPosts, listPendingPosts } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

/**
 * `/clans/:clanId/board` — bảng tin dòng họ. Feed + composer + comment.
 * Moderation queue ở `/clans/:clanId/board/moderation` (admin only).
 */
export default function Board() {
  const { clanId } = useParams<{ clanId: string }>();
  const { user } = useAuth();
  const { clan } = useClanContext();
  const admin = isClanAdmin(clan);

  const postsQ = useQuery({
    queryKey: queryKeys.clanPosts(clanId!),
    queryFn: () => listClanPosts(clanId!),
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

  return (
    <div className="space-y-5">
      <nav>
        <BackLink fallback={`/clans/${clanId}`} />
      </nav>

      <header className="flex items-start gap-3">
        <IconScroll className="h-8 w-8 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="clan-name text-2xl sm:text-3xl font-semibold leading-tight">
            Bảng tin
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Tin tức, sự kiện, sinh, mất, thông báo — cho cả họ cùng đọc.
          </p>
        </div>
      </header>

      {!isMember && (
        <Alert>
          <AlertDescription>
            Bạn đang xem dưới dạng khách. Tham gia dòng họ để đăng bài và
            bình luận.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {isMember && user && <ClanPostComposer clan={clan} />}
        {admin && (pendingQ.data?.length ?? 0) > 0 && (
          <Link
            to={`/clans/${clanId}/board/moderation`}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            ⏳ {pendingQ.data!.length} bài chờ duyệt →
          </Link>
        )}
      </div>

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

      {postsQ.data?.length === 0 && !postsQ.isLoading && (
        <p className="text-muted-foreground italic">
          Chưa có bài viết nào. Hãy là người đầu tiên đăng tin cho cả họ.
        </p>
      )}

      <ul className="space-y-4">
        {(postsQ.data ?? []).map((post) => (
          <li key={post.id}>
            <ClanPostCard post={post} clan={clan} />
          </li>
        ))}
      </ul>
    </div>
  );
}
