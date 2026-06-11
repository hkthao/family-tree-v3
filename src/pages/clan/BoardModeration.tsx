import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { ClanPostCard } from "@/components/ClanPostCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { listPendingPosts } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

/**
 * `/clans/:clanId/board/moderation` — hàng chờ duyệt cho admin clan.
 * Non-admin redirect về `/board`.
 */
export default function BoardModeration() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();

  if (!isClanAdmin(clan)) {
    return <Navigate to={`/clans/${clanId}/board`} replace />;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.clanPostsPending(clanId!),
    queryFn: () => listPendingPosts(clanId!),
    enabled: !!clanId,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={`/clans/${clanId}/board`} />
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold">Duyệt bài</h1>
        <p className="text-sm text-muted-foreground">
          Bài chờ duyệt từ thành viên. Bấm "Duyệt" để đăng, hoặc "Từ chối"
          để ẩn (vẫn lưu lại — có thể hiện lại sau).
        </p>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {data?.length === 0 && !isLoading && (
        <Alert>
          <AlertDescription>
            Không có bài nào đang chờ. Tất cả đã được xử lý.{" "}
            <Link to={`/clans/${clanId}/board`} className="underline">
              Quay về bảng tin
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <ul className="space-y-4">
        {(data ?? []).map((post) => (
          <li key={post.id}>
            <ClanPostCard post={post} clan={clan} />
          </li>
        ))}
      </ul>
    </div>
  );
}
