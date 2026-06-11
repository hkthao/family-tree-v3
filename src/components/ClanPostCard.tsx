import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin } from "@/hooks/useClanContext";
import {
  createComment,
  listCommentsForPost,
  moderateClanPost,
  type ClanPost,
  type ClanPostType,
} from "@/lib/queries/clan_posts";
import type { ClanDetail } from "@/lib/queries/clan-detail";
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
 * Card hiển 1 bài bảng tin. Bao gồm:
 *  - Badge type + status (chỉ hiện badge status khi không phải published)
 *  - Comments lazy-load khi click "Bình luận (N)"
 *  - Admin actions (publish/hide/pin/unpin) qua dropdown
 *
 * Tin `pending` của chính author: hiện kèm note vàng "Đang chờ duyệt".
 */
export function ClanPostCard({
  post,
  clan,
}: {
  post: ClanPost;
  clan: ClanDetail;
}) {
  const { user } = useAuth();
  const isAdmin = isClanAdmin(clan);
  const isAuthor = user?.id === post.author_id;
  const isPending = post.status === "pending";
  const isHidden = post.status === "hidden";

  const [showComments, setShowComments] = useState(false);

  return (
    <article
      className={`rounded-lg border bg-card p-4 space-y-3 ${
        post.pinned ? "border-primary/40 ring-1 ring-primary/10" : ""
      } ${isPending ? "border-amber-500/40" : ""} ${
        isHidden ? "opacity-60 border-dashed" : ""
      }`}
    >
      <header className="flex items-start gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${TYPE_BADGE[post.type]}`}
        >
          {TYPE_LABEL[post.type]}
        </span>
        {post.pinned && (
          <span className="inline-flex items-center text-xs text-primary font-medium">
            📌 Ghim
          </span>
        )}
        {isPending && (
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            ⏳ Đang chờ duyệt
          </span>
        )}
        {isHidden && (
          <span className="text-xs text-muted-foreground italic">
            Đã ẩn
          </span>
        )}
        <time
          className="text-xs text-muted-foreground ml-auto tabular-nums"
          dateTime={post.created_at}
        >
          {new Date(post.created_at).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </header>

      {post.title && <h3 className="font-semibold text-base">{post.title}</h3>}
      <p className="whitespace-pre-line text-sm leading-relaxed">{post.body}</p>

      {post.event_date && (
        <p className="text-sm">
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
        <p className="text-xs">
          <Link
            to={`/clans/${post.clan_id}/people/${post.person_id}`}
            className="text-primary hover:underline"
          >
            Xem trang người liên quan →
          </Link>
        </p>
      )}

      <footer className="flex items-center gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComments((v) => !v)}
        >
          {showComments ? "Ẩn bình luận" : "Bình luận"}
        </Button>
        {isAdmin && (
          <AdminActions post={post} canPin={post.status === "published"} />
        )}
        {(isAuthor || isAdmin) && (
          <span className="text-xs text-muted-foreground ml-auto">
            Tác giả: {isAuthor ? "bạn" : post.author_id.slice(0, 8)}
          </span>
        )}
      </footer>

      {showComments && <CommentsSection postId={post.id} clan={clan} />}
    </article>
  );
}

function AdminActions({
  post,
  canPin,
}: {
  post: ClanPost;
  canPin: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const moderateM = useMutation({
    mutationFn: (action: Parameters<typeof moderateClanPost>[1]) =>
      moderateClanPost(post.id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clanPosts(post.clan_id) });
      qc.invalidateQueries({
        queryKey: queryKeys.clanPostsPending(post.clan_id),
      });
      qc.invalidateQueries({ queryKey: queryKeys.clanPostAudit(post.id) });
      toast.success("Đã cập nhật");
    },
    onError: (e) =>
      toast.error("Không cập nhật được", { description: (e as Error).message }),
  });

  return (
    <div className="flex items-center gap-1.5">
      {post.status === "pending" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => moderateM.mutate("publish")}
            disabled={moderateM.isPending}
          >
            ✓ Duyệt
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => moderateM.mutate("reject")}
            disabled={moderateM.isPending}
            className="text-destructive"
          >
            ✕ Từ chối
          </Button>
        </>
      )}
      {post.status === "published" && (
        <>
          {canPin &&
            (post.pinned ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moderateM.mutate("unpin")}
                disabled={moderateM.isPending}
              >
                Bỏ ghim
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moderateM.mutate("pin")}
                disabled={moderateM.isPending}
              >
                Ghim
              </Button>
            ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => moderateM.mutate("hide")}
            disabled={moderateM.isPending}
            className="text-destructive"
          >
            Ẩn
          </Button>
        </>
      )}
      {post.status === "hidden" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => moderateM.mutate("unhide")}
          disabled={moderateM.isPending}
        >
          Hiện lại
        </Button>
      )}
    </div>
  );
}

function CommentsSection({
  postId,
  clan,
}: {
  postId: string;
  clan: ClanDetail;
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

  const canComment = !!user && (clan.myRole !== null || clan.isPlatformAdmin);

  return (
    <div className="space-y-3 pt-3 border-t">
      {commentsQ.isLoading && (
        <p className="text-xs text-muted-foreground">Đang tải bình luận…</p>
      )}
      <ul className="space-y-2">
        {(commentsQ.data ?? []).map((c) => (
          <li
            key={c.id}
            className="rounded-md bg-muted/40 px-3 py-2 text-sm space-y-1"
          >
            <p className="whitespace-pre-line">{c.body}</p>
            <p className="text-xs text-muted-foreground">
              {c.author_id === user?.id
                ? "bạn"
                : c.author_id.slice(0, 8)}{" "}
              ·{" "}
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
          <li className="text-xs text-muted-foreground italic">
            Chưa có bình luận.
          </li>
        )}
      </ul>

      {canComment && (
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
    </div>
  );
}
