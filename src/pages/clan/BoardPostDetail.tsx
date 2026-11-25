import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  Article,
  ArticleActionBar,
  ArticleFactBox,
  ArticleHeader,
  ArticleProse,
  ArticleSection,
} from "@/components/Article";
import { usePanel } from "@/components/panel/usePanel";
import { normalizePostMarkdown } from "@/lib/postMarkdown";
import { Button } from "@/components/ui/button";
import { DrawerViewActions } from "@/components/ui/form-actions";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconLock,
  IconPencil,
  IconPin,
  IconSend,
  IconUnlock,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
const TYPE_LABEL: Record<ClanPostType, string> = lazyMessages({
  news: msg`Tin`,
  event: msg`Sự kiện`,
  birth: msg`Sinh`,
  death: msg`Cáo phó`,
  notice: msg`Thông báo`,
}) as Record<ClanPostType, string>;

/**
 * `/clans/:clanId/board/:postId` — trang chi tiết 1 bài bảng tin.
 * Reader-style như AnnouncementDetail. Comments hiện trực tiếp dưới
 * bài. Admin/author có nút Sửa + Moderate actions.
 */
/** Hiện trong ngăn kéo XEM (bấm bài ở Bảng tin): lấy id từ đây, bỏ breadcrumb, thanh nút là DrawerViewActions. */
export interface EmbeddedBoardPost {
  id: string;
  onClose: () => void;
}

// Trình hiển thị Markdown kéo theo thư viện lớn → nạp khi mở bài.
const MarkdownView = lazy(() => import("@/components/markdown/MarkdownView"));

export default function BoardPostDetail({
  embedded,
}: { embedded?: EmbeddedBoardPost } = {}) {
  const params = useParams<{ postId: string }>();
  const postId = embedded?.id ?? params.postId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clan } = useClanContext();
  const clanId = clan.id;
  const isAdmin = isClanAdmin(clan);

  const {
    data: post,
    isLoading,
    error,
  } = useQuery({
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
      {!embedded && (
        <Breadcrumb
          items={[
            { label: clan.name, to: `/clans/${clanId}` },
            { label: t`Bảng tin`, to: `/clans/${clanId}/board` },
            { label: post?.title ?? t`Bài viết` },
          ]}
        />
      )}

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !post && (
        <Alert>
          <AlertDescription>
            {t`Không thấy bài. Có thể đã bị ẩn hoặc bạn không có quyền xem.`}
          </AlertDescription>
        </Alert>
      )}

      {post && (
        <>
          {/* Dạng bài báo (components/Article): chuyên mục → tít → ngày · người đăng → thân bài → thông tin → bình luận. */}
          <Article>
            <ArticleHeader
              kicker={TYPE_LABEL[post.type]}
              title={post.title || TYPE_LABEL[post.type]}
              meta={[
                post.pinned ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <IconPin className="h-3.5 w-3.5" />
                    {t`Đã ghim`}
                  </span>
                ) : null,
                isPending ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    {t`Chờ duyệt`}
                  </span>
                ) : null,
                isHidden ? <span className="italic">{t`Đã ẩn`}</span> : null,
                <time className="tabular-nums" dateTime={post.created_at}>
                  {new Date(post.created_at).toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>,
                isAuthor ? t`bạn` : post.author_id.slice(0, 8),
              ]}
            />

            <ArticleSection>
              <Suspense fallback={<ArticleProse>{t`Đang tải…`}</ArticleProse>}>
                <MarkdownView source={normalizePostMarkdown(post.body)} />
              </Suspense>
            </ArticleSection>

            <ArticleFactBox
              title={t`Thông tin`}
              rows={[
                {
                  label: t`Ngày diễn ra`,
                  value: post.event_date
                    ? new Date(post.event_date).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : null,
                },
                {
                  label: t`Người liên quan`,
                  value: post.person_id && (
                    <Link
                      to={`/clans/${clanId}/people/${post.person_id}`}
                      className="text-primary hover:underline"
                    >
                      {t`Xem trang người liên quan →`}
                    </Link>
                  ),
                },
              ]}
            />

            <Comments
              postId={post.id}
              isMember={clan.myRole !== null || clan.isPlatformAdmin}
            />
          </Article>

          {(canEdit || isAdmin) && (
            <PostActionBar
              postId={post.id}
              clanId={post.clan_id}
              status={post.status}
              pinned={post.pinned}
              canEdit={canEdit}
              isAdmin={isAdmin}
              inDrawer={!!embedded}
              onAfter={(action) => {
                if (action === "reject" || action === "hide") {
                  if (embedded) embedded.onClose();
                  else navigate(`/clans/${clanId}/board`);
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Post actions ─────────────────────────────────────────────────
//
// Thanh dính đáy (trang: ArticleActionBar; ngăn kéo: DrawerViewActions) thay menu ba chấm: phá huỷ (Từ chối / Ẩn) → phụ (Ghim, Duyệt, Hiện lại) → Sửa.

function PostActionBar({
  postId,
  clanId,
  status,
  pinned,
  canEdit,
  isAdmin,
  inDrawer,
  onAfter,
}: {
  inDrawer: boolean;
  postId: string;
  clanId: string;
  status: string;
  pinned: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  onAfter: (action: ClanPostModerateAction) => void;
}) {
  const { open: openPanel } = usePanel();
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
      toast.success(t`Đã cập nhật`);
      onAfter(action);
    },
    onError: (e) =>
      toast.error(t`Không cập nhật được`, {
        description: (e as Error).message,
      }),
  });
  const busy = moderateM.isPending;
  const ic = "mr-1.5 h-4 w-4 shrink-0";
  const Bar = inDrawer ? DrawerViewActions : ArticleActionBar;

  return (
    <Bar>
      {isAdmin && status === "pending" && (
        <Button
          variant="destructive-outline"
          disabled={busy}
          onClick={() => moderateM.mutate("reject")}
        >
          <IconX className={ic} />
          {t`Từ chối`}
        </Button>
      )}
      {isAdmin && status === "published" && (
        <Button
          variant="destructive-outline"
          disabled={busy}
          onClick={() => moderateM.mutate("hide")}
        >
          <IconLock className={ic} />
          {t`Ẩn bài`}
        </Button>
      )}
      {isAdmin && status === "published" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => moderateM.mutate(pinned ? "unpin" : "pin")}
        >
          <IconPin className={ic} />
          {pinned ? t`Bỏ ghim` : t`Ghim`}
        </Button>
      )}
      {isAdmin && status === "hidden" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => moderateM.mutate("unhide")}
        >
          <IconUnlock className={ic} />
          {t`Hiện lại`}
        </Button>
      )}
      {isAdmin && status === "pending" && (
        <Button
          variant={canEdit ? "outline" : "default"}
          disabled={busy}
          onClick={() => moderateM.mutate("publish")}
        >
          <IconCheck className={ic} />
          {t`Duyệt đăng`}
        </Button>
      )}
      {canEdit && (
        <Button onClick={() => openPanel("board-edit", { pid: postId })}>
          <IconPencil className={ic} />
          {t`Sửa`}
        </Button>
      )}
    </Bar>
  );
}

// ─── Comments ──────────────────────────────────────────────────────

function Comments({ postId, isMember }: { postId: string; isMember: boolean }) {
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
    <ArticleSection title={t`Bình luận`} aside={commentsQ.data?.length ?? 0}>
      <div className="space-y-3 font-sans">
        <ul className="space-y-2">
          {(commentsQ.data ?? []).map((c) => (
            <li
              key={c.id}
              className="rounded-md bg-muted/40 px-3 py-2 text-sm space-y-1"
            >
              <p className="whitespace-pre-line">{c.body}</p>
              <p className="text-xs text-muted-foreground">
                {c.author_id === user?.id ? t`bạn` : c.author_id.slice(0, 8)}
                {" · "}
                {new Date(c.created_at).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
                {c.status === "hidden" && (
                  <span className="ml-2 italic">{t`đã ẩn`}</span>
                )}
              </p>
            </li>
          ))}
          {(commentsQ.data ?? []).length === 0 && !commentsQ.isLoading && (
            <li className="text-sm text-muted-foreground italic">
              {t`Chưa có bình luận.`}
            </li>
          )}
        </ul>

        {isMember && user && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) createM.mutate();
            }}
            className="relative"
          >
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t`Viết bình luận…`}
              maxLength={4000}
              className="w-full h-10 rounded-md border border-input bg-background pl-3 pr-11 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!body.trim() || createM.isPending}
              aria-label={t`Gửi bình luận`}
              title={t`Gửi`}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <IconSend className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </ArticleSection>
  );
}
