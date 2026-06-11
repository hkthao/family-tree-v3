import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { BoardPostForm } from "@/components/BoardPostForm";
import { Breadcrumb } from "@/components/Breadcrumb";
import { IconPencil } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { getClanPost } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

/**
 * `/clans/:clanId/board/:postId/edit` — sửa bài. Chỉ author hoặc
 * admin clan (RLS sẽ chặn, kiểm tra ở UI để báo lỗi sớm).
 */
export default function BoardPostEdit() {
  const { clanId, postId } = useParams<{
    clanId: string;
    postId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clan } = useClanContext();

  const { data: post, isLoading, error } = useQuery({
    queryKey: queryKeys.clanPost(postId!),
    queryFn: () => getClanPost(postId!),
    enabled: !!postId,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải…</p>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  if (!post) {
    return <Navigate to={`/clans/${clanId}/board`} replace />;
  }

  const canEdit =
    post.author_id === user?.id || isClanAdmin(clan);
  if (!canEdit) {
    return <Navigate to={`/clans/${clanId}/board/${postId}`} replace />;
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Bảng tin", to: `/clans/${clanId}/board` },
          {
            label: post.title ?? "Bài viết",
            to: `/clans/${clanId}/board/${postId}`,
          },
          { label: "Sửa" },
        ]}
      />

      <PageHeader
        icon={<IconPencil className="h-7 w-7" />}
        title="Sửa bài"
      />

      <BoardPostForm
        clan={clan}
        post={post}
        onDone={(id) => navigate(`/clans/${clanId}/board/${id}`)}
        onCancel={() => navigate(`/clans/${clanId}/board/${postId}`)}
      />
    </div>
  );
}
