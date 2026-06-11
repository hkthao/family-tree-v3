import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconLock,
  IconMore,
  IconPencil,
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
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Bảng tin", to: `/clans/${clanId}/board` },
          { label: post?.title ?? "Bài viết" },
        ]}
      />

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
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap text-xs uppercase tracking-wider text-muted-foreground min-w-0">
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

            {(canEdit || isAdmin) && (
              <PostActionsMenu
                postId={post.id}
                clanId={post.clan_id}
                status={post.status}
                pinned={post.pinned}
                canEdit={canEdit}
                isAdmin={isAdmin}
                onAfter={(action) => {
                  if (action === "reject" || action === "hide") {
                    navigate(`/clans/${clanId}/board`);
                  }
                }}
              />
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

          <Comments
            postId={post.id}
            isMember={clan.myRole !== null || clan.isPlatformAdmin}
          />
        </article>
      )}
    </div>
  );
}

// ─── Post actions menu ────────────────────────────────────────────
//
// Kebab dropdown ở top-right article — pattern quen thuộc của
// Facebook / Medium / WordPress. Gom Sửa + mọi moderation action
// vào 1 menu thay vì cụm 3 nút chiếm chỗ.

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

function PostActionsMenu({
  postId,
  clanId,
  status,
  pinned,
  canEdit,
  isAdmin,
  onAfter,
}: {
  postId: string;
  clanId: string;
  status: string;
  pinned: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  onAfter: (action: ClanPostModerateAction) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click ngoài menu → đóng. Bám phổ thông UX của dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

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
      setOpen(false);
      onAfter(action);
    },
    onError: (e) =>
      toast.error("Không cập nhật được", {
        description: (e as Error).message,
      }),
  });

  const items: MenuItem[] = [];
  if (canEdit) {
    items.push({
      key: "edit",
      label: "Sửa",
      icon: <IconPencil className="h-4 w-4" />,
      onClick: () => {
        setOpen(false);
        navigate(`/clans/${clanId}/board/${postId}/edit`);
      },
    });
  }
  if (isAdmin) {
    if (status === "pending") {
      items.push({
        key: "publish",
        label: "Duyệt đăng",
        icon: <IconCheck className="h-4 w-4" />,
        onClick: () => moderateM.mutate("publish"),
      });
      items.push({
        key: "reject",
        label: "Từ chối",
        icon: <IconX className="h-4 w-4" />,
        onClick: () => moderateM.mutate("reject"),
        destructive: true,
      });
    }
    if (status === "published") {
      items.push({
        key: pinned ? "unpin" : "pin",
        label: pinned ? "Bỏ ghim" : "Ghim lên đầu",
        icon: <span aria-hidden="true">📌</span>,
        onClick: () => moderateM.mutate(pinned ? "unpin" : "pin"),
      });
      items.push({
        key: "hide",
        label: "Ẩn bài",
        icon: <IconLock className="h-4 w-4" />,
        onClick: () => moderateM.mutate("hide"),
        destructive: true,
      });
    }
    if (status === "hidden") {
      items.push({
        key: "unhide",
        label: "Hiện lại",
        icon: <IconUnlock className="h-4 w-4" />,
        onClick: () => moderateM.mutate("unhide"),
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Hành động"
        title="Hành động"
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
      >
        <IconMore className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-48 z-20 rounded-md border bg-card shadow-lg py-1"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={item.onClick}
              disabled={moderateM.isPending}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted disabled:opacity-50 ${
                item.destructive ? "text-destructive" : ""
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
          className="relative"
        >
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Viết bình luận…"
            maxLength={4000}
            className="w-full h-10 rounded-md border border-input bg-background pl-3 pr-11 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!body.trim() || createM.isPending}
            aria-label="Gửi bình luận"
            title="Gửi"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </form>
      )}
    </section>
  );
}
