import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";

import {
  IconArrowLeft,
  IconArrowRight,
  IconCopy,
  IconFacebook,
  IconShare2,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  fetchSitePosts,
  fetchSitePost,
  SitePartError,
} from "@/lib/queries/site-parts";
import { normalizePostMarkdown, postExcerpt } from "@/lib/postMarkdown";
import { sitePagePath } from "@/lib/siteSections";

import { formatPostDate, postTypeLabel } from "./postUi";
import { useSite } from "./siteContext";

// Trình hiển thị Markdown kéo theo thư viện lớn → tải khi cần.
const MarkdownView = lazy(() => import("@/components/markdown/MarkdownView"));

/** Trang đọc một bài Bảng tin (Markdown) — kiểu blog: tiêu đề, thông tin, nội dung, chia sẻ, bài trước/sau, đọc tiếp. */
export default function SitePost() {
  const { postId = "" } = useParams<{ postId: string }>();
  const { base, access } = useSite();
  const toast = useToast();
  const {
    data: post,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "post", postId],
    queryFn: () => fetchSitePost(access, postId),
    retry: false,
  });
  const { data: more } = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "posts", "", 1, "more"],
    queryFn: () => fetchSitePosts(access, { page: 1, per: 5 }),
    retry: false,
  });
  usePageTitle(post?.title ?? null, post ? postExcerpt(post.body, 160) : null);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t`Đã sao chép liên kết.`);
    } catch {
      toast.error(t`Không sao chép được liên kết.`);
    }
  };
  const canNativeShare =
    typeof navigator !== "undefined" && "share" in navigator;

  if (isLoading)
    return (
      <p className="py-16 text-center text-muted-foreground">{t`Đang tải…`}</p>
    );
  if (error || !post) {
    const gone = error instanceof SitePartError && error.status === 404;
    return (
      <div className="container max-w-2xl py-16 text-center">
        <p className="mb-4 text-muted-foreground">
          {gone
            ? t`Bài viết này không còn.`
            : ((error as Error | null)?.message ?? t`Không tải được bài viết.`)}
        </p>
        <Button asChild size="sm" variant="outline" className="px-3 text-sm">
          <Link to={sitePagePath(base, "board")}>
            <IconArrowLeft className="mr-1.5 h-4 w-4" />
            {t`Về Bảng tin`}
          </Link>
        </Button>
      </div>
    );
  }
  const others = (more?.items ?? [])
    .filter((p) => p.id !== post.id)
    .slice(0, 3);

  return (
    <div className="container flex max-w-6xl flex-wrap items-start gap-x-12 gap-y-10 py-8">
      <article className="min-w-0 max-w-3xl flex-[1_1_36rem]">
        <Link
          to={sitePagePath(base, "board")}
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          {t`Bảng tin`}
        </Link>
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          {postTypeLabel(post.type)}
        </div>
        <h1 className="clan-name mb-4 mt-2 break-words text-3xl font-bold leading-tight md:text-4xl">
          {post.title}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b pb-5 text-sm text-muted-foreground">
          <span>{t`Đăng ${formatPostDate(post.created_at)}`}</span>
          <span>{t`${post.read_minutes} phút đọc`}</span>
        </div>

        <div className="site-prose mt-6 break-words">
          <Suspense
            fallback={<p className="text-muted-foreground">{t`Đang tải…`}</p>}
          >
            <MarkdownView source={normalizePostMarkdown(post.body)} />
          </Suspense>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2 border-y py-4 max-sm:[&>*]:flex-1">
          <span className="mr-1 hidden text-sm text-muted-foreground sm:inline">{t`Chia sẻ bài này`}</span>
          {canNativeShare && (
            <Button
              size="sm"
              variant="outline"
              className="px-3 text-sm"
              onClick={() =>
                void navigator.share({ title: post.title, url }).catch(() => {})
              }
            >
              <IconShare2 className="mr-1.5 h-4 w-4" />
              {t`Chia sẻ`}
            </Button>
          )}
          {/* Link riêng (có token) là chìa khoá mở cả trang dòng họ: không đẩy thẳng lên Facebook (trình quét của họ đọc và hiện công khai). */}
          {!access.token && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="px-3 text-sm"
            >
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconFacebook className="mr-1.5 h-4 w-4" />
                Facebook
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="px-3 text-sm"
            onClick={() => void copy()}
          >
            <IconCopy className="mr-1.5 h-4 w-4" />
            {t`Sao chép liên kết`}
          </Button>
        </div>

        {(post.prev || post.next) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {post.prev && (
              <Link
                to={sitePagePath(base, "board", post.prev.id)}
                className="flex min-w-0 flex-[1_1_14rem] items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-primary"
              >
                <IconArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-xs text-muted-foreground">{t`Bài trước`}</div>
                  <div className="clan-name line-clamp-2 break-words font-semibold">
                    {post.prev.title}
                  </div>
                </div>
              </Link>
            )}
            {post.next && (
              <Link
                to={sitePagePath(base, "board", post.next.id)}
                className="flex min-w-0 flex-[1_1_14rem] items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-primary"
              >
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-xs text-muted-foreground">{t`Bài sau`}</div>
                  <div className="clan-name line-clamp-2 break-words font-semibold">
                    {post.next.title}
                  </div>
                </div>
                <IconArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </div>
        )}
      </article>

      {others.length > 0 && (
        <aside className="w-full min-w-0 flex-[1_1_18rem] lg:max-w-xs">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="clan-name mb-2 text-lg font-bold">{t`Đọc tiếp`}</h2>
            {others.map((p) => (
              <Link
                key={p.id}
                to={sitePagePath(base, "board", p.id)}
                className="block border-t py-3 first:border-t-0"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {postTypeLabel(p.type)}
                </span>
                <span className="clan-name line-clamp-2 block break-words font-semibold leading-snug">
                  {p.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPostDate(p.created_at)}
                </span>
              </Link>
            ))}
            <Link
              to={sitePagePath(base, "board")}
              className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary"
            >
              {t`Xem tất cả bài viết`} <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}
