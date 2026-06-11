import { Link } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin } from "@/hooks/useClanContext";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { type ClanPost, type ClanPostType } from "@/lib/queries/clan_posts";

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
 * Card preview ở trang feed. Click → trang chi tiết để xem đầy đủ +
 * comment + admin actions. Card này KHÔNG còn inline comment/admin
 * — pattern AnnouncementCard.
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

  return (
    <article
      className={`relative h-full overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted/30 ${
        isHidden ? "opacity-60" : ""
      }`}
    >
      {/* Dải accent mép trái: amber cho pending, primary cho pinned. */}
      {(isPending || post.pinned) && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 bottom-0 w-1 ${
            isPending ? "bg-amber-500/70" : "bg-primary/80"
          }`}
        />
      )}

      {/* Flex column với meta-row pinned ở đáy (mt-auto). Title +
          body chiếm phần trên với height cố định qua line-clamp →
          mọi card cùng height. */}
      <Link
        to={`/clans/${post.clan_id}/board/${post.id}`}
        className="flex flex-col h-full px-5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        {post.title ? (
          <h3 className="text-base leading-snug font-semibold line-clamp-1">
            {post.pinned && (
              <span
                className="text-primary mr-1.5"
                title="Đã ghim"
                aria-label="Đã ghim"
              >
                📌
              </span>
            )}
            {post.title}
          </h3>
        ) : (
          // Không có title — placeholder height để khớp card có title.
          <h3 aria-hidden="true" className="text-base leading-snug">
            &nbsp;
          </h3>
        )}

        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {post.body}
        </p>

        <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap text-xs">
          <time
            className="text-muted-foreground tabular-nums"
            dateTime={post.created_at}
            title={new Date(post.created_at).toLocaleString("vi-VN")}
          >
            {formatRelative(post.created_at)}
          </time>
          {(isAuthor || isAdmin) && (
            <span className="text-muted-foreground">
              · {isAuthor ? "bạn" : post.author_id.slice(0, 8)}
            </span>
          )}
          {isPending && (
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              · Chờ duyệt
            </span>
          )}
          {isHidden && (
            <span className="text-muted-foreground italic">· Đã ẩn</span>
          )}
          <span
            className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${TYPE_BADGE[post.type]}`}
          >
            {TYPE_LABEL[post.type]}
          </span>
        </div>
      </Link>
    </article>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDay === 1) return "Hôm qua";
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
