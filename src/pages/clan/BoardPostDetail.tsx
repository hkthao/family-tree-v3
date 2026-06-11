import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconLock,
  IconPencil,
  IconUnlock,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import {
  createComment,
  getClanPost,
  listCommentsForPost,
  moderateClanPost,
  type ClanPostModerateAction,
  type ClanPostType,
} from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

const TYPE_LABEL: Record<ClanPostType, string> = {
  news: "Tin",
  event: "Sự kiện",
  birth: "Sinh",
  death: "Cáo phó",
  notice: "Thông báo",
};

const TYPE_BADGE: Record<ClanPostType, string> = {
  news: "bg-muted text-foreground border-border",
  event: "bg-primary/10 text-primary border-primary/30",
  birth:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  death:
    "bg-amber-700/10 text-amber-800 dark:text-amber-300 border-amber-700/30",
  notice: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
};

/**
 * `/clans/:clanId/board/:postId` — trang chi tiết 1 bài bảng tin.
 * Reader-style như AnnouncementDetail. Comments hiện trực tiếp dưới
 * bài. Admin/author có nút Sửa + Moderate actions.
 */
export default function BoardPostDetail() {
  const { clanId, postId } = useParams<{
    clanId: string;
    postId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clan } = useClanContext();
  const isAdmin = isClanAdmin(clan);

  const { data: post, isLoading, error } = useQuery({
    queryKey: queryKeys.clanPost(postId!),
    queryFn: () => getClanPost(postId!),
    enabled: !!postId,
  });

  const isAuthor = !!user && post?.author_id === user.id;
  const canEdit = isAuthor || isAdmin;
  const isPending = post?.status === "pending";
  const isHidden = post?.status === "hidden";

  return (
    <div className="space-y-3">
      <nav>
        <BackLink fallback={`/clans/${clanId}/board`} />
      </nav>

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !post && (
        <Alert>
          <AlertDescription>
            Không thấy bài. Có thể đã bị ẩn hoặc bạn không có quyền xem.
          </AlertDescription>
        </Alert>
      )}

      {post && (
        <article>
          <div className="flex items-center gap-2 flex-wrap text-xs uppercase tracking-wider text-muted-foreground">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium normal-case ${TYPE_BADGE[post.type]}`}
            >
              {TYPE_LABEL[post.type]}
            </span>
            {post.pinned && (
              <span className="text-primary normal-case">📌 Đã ghim</span>
            )}
            {isPending && (
              <span className="text-amber-700 dark:text-amber-300 normal-case">
                Chờ duyệt
              </span>
            )}
            {isHidden && (
              <span className="italic normal-case">Đã ẩn</span>
            )}
          </div>

          {post.title && (
            <h1 className="clan-name text-2xl sm:text-3xl font-semibold leading-tight mt-3 mb-2">
              {post.title}
            </h1>
          )}

          <time
            className="block text-sm text-muted-foreground tabular-nums"
            dateTime={post.created_at}
          >
            {new Date(post.created_at).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            {isAuthor ? "bạn" : post.author_id.slice(0, 8)}
          </time>

          <hr className="my-5 border-border" />

          <div className="text-[17px] leading-[1.75] whitespace-pre-line text-foreground/90">
            {post.body}
          </div>

          {post.event_date && (
            <p className="mt-5 text-sm">
              <span className="text-muted-foreground">Ngày diễn ra: </span>
              <strong>
                {new Date(post.event_date).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </strong>
            </p>
          )}

          {post.person_id && (
            <p className="mt-3 text-sm">
              <Link
                to={`/clans/${clanId}/people/${post.person_id}`}
                className="text-primary hover:underline"
              >
                Xem trang người liên quan →
              </Link>
            </p>
          )}

          {/* Actions row — flex-1 cho mỗi nút để width bằng nhau */}
          <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t [&>*]:flex-1">
            {canEdit && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/clans/${clanId}/board/${post.id}/edit`}>
                  <IconPencil className="h-4 w-4 mr-1.5" />
                  Sửa
                </Link>
              </Button>
            )}
            {isAdmin && (
              <ModerationActions
                postId={post.id}
                status={post.status}
                pinned={post.pinned}
                clanId={post.clan_id}
                onAfter={(action) => {
                  if (action === "reject" || action === "hide") {
                    navigate(`/clans/${clanId}/board`);
                  }
                }}
              />
            )}
          </div>

          <Comments
            postId={post.id}
            isMember={clan.myRole !== null || clan.isPlatformAdmin}
          />
        </article>
      )}
    </div>
  );
}

// ─── Moderation actions ────────────────────────────────────────────

function ModerationActions({
  postId,
  status,
  pinned,
  clanId,
  onAfter,
}: {
  postId: string;
  status: string;
  pinned: boolean;
  clanId: string;
  onAfter: (action: ClanPostModerateAction) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const moderateM = useMutation({
    mutationFn: (action: ClanPostModerateAction) =>
      moderateClanPost(postId, action),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: queryKeys.clanPost(postId) });
      qc.invalidateQueries({ queryKey: queryKeys.clanPosts(clanId) });
      qc.invalidateQueries({
        queryKey: queryKeys.clanPostsPending(clanId),
      });
      toast.success("Đã cập nhật");
      onAfter(action);
    },
    onError: (e) =>
      toast.error("Không cập nhật được", {
        description: (e as Error).message,
      }),
  });

  if (status === "pending") {
    return (
      <>
        <Button
          size="sm"
          onClick={() => moderateM.mutate("publish")}
          disabled={moderateM.isPending}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          Duyệt
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => moderateM.mutate("reject")}
          disabled={moderateM.isPending}
        >
          <IconX className="h-4 w-4 mr-1.5" />
          Từ chối
        </Button>
      </>
    );
  }
  if (status === "published") {
    return (
      <>
        {pinned ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => moderateM.mutate("unpin")}
            disabled={moderateM.isPending}
          >
            <span className="mr-1.5" aria-hidden="true">📌</span>
            Bỏ ghim
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => moderateM.mutate("pin")}
            disabled={moderateM.isPending}
          >
            <span className="mr-1.5" aria-hidden="true">📌</span>
            Ghim
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => moderateM.mutate("hide")}
          disabled={moderateM.isPending}
        >
          <IconLock className="h-4 w-4 mr-1.5" />
          Ẩn
        </Button>
      </>
    );
  }
  if (status === "hidden") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => moderateM.mutate("unhide")}
        disabled={moderateM.isPending}
      >
        <IconUnlock className="h-4 w-4 mr-1.5" />
        Hiện lại
      </Button>
    );
  }
  return null;
}

// ─── Comments ──────────────────────────────────────────────────────

function Comments({
  postId,
  isMember,
}: {
  postId: string;
  isMember: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const commentsQ = useQuery({
    queryKey: queryKeys.clanPostComments(postId),
    queryFn: () => listCommentsForPost(postId),
    staleTime: 30_000,
  });

  const createM = useMutation({
    mutationFn: () => createComment(postId, body.trim()),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: queryKeys.clanPostComments(postId) });
    },
  });

  return (
    <section className="mt-8 pt-6 border-t space-y-3">
      <h2 className="text-lg font-semibold">
        Bình luận ({commentsQ.data?.length ?? 0})
      </h2>

      <ul className="space-y-2">
        {(commentsQ.data ?? []).map((c) => (
          <li
            key={c.id}
            className="rounded-md bg-muted/40 px-3 py-2 text-sm space-y-1"
          >
            <p className="whitespace-pre-line">{c.body}</p>
            <p className="text-xs text-muted-foreground">
              {c.author_id === user?.id ? "bạn" : c.author_id.slice(0, 8)}
              {" · "}
              {new Date(c.created_at).toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              })}
              {c.status === "hidden" && (
                <span className="ml-2 italic">đã ẩn</span>
              )}
            </p>
          </li>
        ))}
        {(commentsQ.data ?? []).length === 0 && !commentsQ.isLoading && (
          <li className="text-sm text-muted-foreground italic">
            Chưa có bình luận.
          </li>
        )}
      </ul>

      {isMember && user && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) createM.mutate();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Viết bình luận…"
            maxLength={4000}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || createM.isPending}
          >
            Gửi
          </Button>
        </form>
      )}
    </section>
  );
}
