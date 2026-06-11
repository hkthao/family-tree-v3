import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ClanPostCard } from "@/components/ClanPostCard";
import { ClanPostComposer } from "@/components/ClanPostComposer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <h2 className="text-2xl font-semibold sm:flex-1">Bảng tin</h2>
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
          {admin && (pendingQ.data?.length ?? 0) > 0 && (
            <Link
              to={`/clans/${clanId}/board/moderation`}
              className="h-10 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
            >
              ⏳ {pendingQ.data!.length} chờ duyệt
            </Link>
          )}
          {isMember && user && !composerOpen && (
            <Button
              size="sm"
              className="h-10"
              onClick={() => setComposerOpen(true)}
            >
              + Đăng bài mới
            </Button>
          )}
        </div>
      </div>

      {!isMember && (
        <Alert>
          <AlertDescription>
            Bạn đang xem dưới dạng khách. Tham gia dòng họ để đăng bài và
            bình luận.
          </AlertDescription>
        </Alert>
      )}

      {isMember && user && (
        <ClanPostComposer
          clan={clan}
          open={composerOpen}
          onOpenChange={setComposerOpen}
        />
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
