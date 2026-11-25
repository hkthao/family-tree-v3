import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { IconArrowLeft, IconArrowRight, IconPin } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { fetchSitePosts, type SitePostItem } from "@/lib/queries/site-parts";
import { cn } from "@/lib/utils";
import { sitePagePath } from "@/lib/siteSections";

import { coverFallbackClass, formatPostDate, POST_TYPES, postTypeLabel } from "./postUi";
import { useSite } from "./siteContext";

const PER = 9;

export function PostCover({ post, className }: { post: Pick<SitePostItem, "id" | "cover">; className?: string }) {
  // Ảnh bìa lấy từ link ngoài nên có thể hỏng / bị chặn → quay về khối màu thay vì để ô trống.
  const [broken, setBroken] = useState(false);
  return post.cover && !broken ? (
    <img
      src={post.cover}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("w-full object-cover", className)}
    />
  ) : (
    <div aria-hidden="true" className={cn("w-full bg-gradient-to-br", coverFallbackClass(post.id), className)} />
  );
}

function PostCard({ post, base }: { post: SitePostItem; base: string }) {
  return (
    <Link
      to={sitePagePath(base, "board", post.id)}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary"
    >
      <PostCover post={post} className="h-36" />
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">{postTypeLabel(post.type)}</span>
        <h3 className="clan-name line-clamp-2 min-h-[2.7em] break-words text-lg font-semibold leading-snug">
          {post.pinned && <IconPin className="mr-1 inline h-4 w-4 text-primary" aria-label={t`Ghim`} />}
          {post.title}
        </h3>
        <p className="line-clamp-2 break-words text-sm text-muted-foreground">{post.excerpt}</p>
        <span className="mt-auto pt-1 text-xs text-muted-foreground">
          {formatPostDate(post.created_at)} · {t`${post.read_minutes} phút đọc`}
        </span>
      </div>
    </Link>
  );
}

function Featured({ post, base }: { post: SitePostItem; base: string }) {
  return (
    <Link
      to={sitePagePath(base, "board", post.id)}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary md:flex-row"
    >
      <PostCover post={post} className="h-56 md:h-auto md:w-1/2" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 p-6 md:p-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          {post.pinned ? `${t`Ghim`} · ` : ""}
          {postTypeLabel(post.type)}
        </span>
        <h2 className="clan-name line-clamp-2 break-words text-2xl font-bold leading-snug md:text-3xl">{post.title}</h2>
        <p className="line-clamp-2 break-words text-muted-foreground">{post.excerpt}</p>
        <span className="text-sm text-muted-foreground">
          {formatPostDate(post.created_at)} · {t`${post.read_minutes} phút đọc`}
        </span>
      </div>
    </Link>
  );
}

/** Trang Bảng tin: lọc theo loại bài (?type=), phân trang (?page=), bài đầu trang 1 hiện lớn. */
export default function SiteBoard() {
  const { base, access } = useSite();
  const [sp, setSp] = useSearchParams();
  const type = POST_TYPES.find((x) => x === sp.get("type")) ?? "";
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "posts", type, page],
    queryFn: () => fetchSitePosts(access, { page, per: PER, type: type || undefined }),
    retry: false,
  });
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setSp(next, { replace: true });
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.per)) : 1;
  const showFeatured = page === 1 && !!data?.items.length && !type;
  const [first, ...rest] = data?.items ?? [];
  const gridItems = showFeatured ? rest : (data?.items ?? []);

  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <h1 className="clan-name text-3xl font-bold md:text-4xl">{t`Bảng tin`}</h1>
      <p className="mb-6 mt-2 max-w-2xl text-muted-foreground">{t`Chuyện của dòng họ: tin vui, thông báo và những ghi chép do người quản lý họ soạn.`}</p>

      <div className="mb-7 flex flex-wrap gap-2" role="tablist" aria-label={t`Lọc bài viết`}>
        {["", ...POST_TYPES].map((x) => (
          <button
            key={x || "all"}
            type="button"
            role="tab"
            aria-selected={type === x}
            onClick={() => setParam({ type: x || null, page: null })}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium",
              type === x ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
            )}
          >
            {x ? postTypeLabel(x) : t`Tất cả`}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-12 text-center text-muted-foreground">{t`Đang tải…`}</p>}
      {error && <p className="py-12 text-center text-destructive">{(error as Error).message}</p>}
      {data && data.items.length === 0 && <p className="py-12 text-center text-muted-foreground">{t`Chưa có bài viết nào.`}</p>}

      {showFeatured && first && (
        <div className="mb-5">
          <Featured post={first} base={base} />
        </div>
      )}
      {gridItems.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((p) => (
            <PostCard key={p.id} post={p} base={base} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t`Phân trang`} className="mt-8 flex items-center justify-center gap-2">
          <Button size="icon-sm" variant="outline" aria-label={t`Trang trước`} disabled={page <= 1} onClick={() => setParam({ page: page - 1 > 1 ? String(page - 1) : null })}>
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-16 text-center tabular-nums text-muted-foreground">
            {page} / {pages}
          </span>
          <Button size="icon-sm" variant="outline" aria-label={t`Trang sau`} disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) })}>
            <IconArrowRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
