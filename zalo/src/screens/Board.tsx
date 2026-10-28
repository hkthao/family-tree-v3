import { useState } from "react";

import { IconArrowRight } from "@/components/icons";
import type { ClanSummary } from "@/lib/queries/clans";
import {
  getClanPost,
  listClanPosts,
  listCommentsForPost,
  type ClanPost,
  type ClanPostType,
} from "@/lib/queries/clan_posts";

import { useRev } from "../rev";
import { useAsync } from "../useAsync";

/**
 * Bảng tin — CHỈ ĐỌC trong Mini App: danh sách (ghim trước, mới nhất
 * trước), chi tiết bài và bình luận. Đăng bài, sửa, bình luận và duyệt bài
 * làm trên web (chủ dự án chốt 24/10/2026). Dùng nguyên
 * `@/lib/queries/clan_posts`; máy chủ chỉ trả bài người xem được phép thấy.
 */
const PAGE_SIZE = 15;

const TYPE_LABEL: Record<ClanPostType, string> = {
  news: "Tin",
  event: "Sự kiện",
  birth: "Sinh",
  death: "Cáo phó",
  notice: "Thông báo",
};

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  const hr = Math.round(diff / 3_600_000);
  const day = Math.round(diff / 86_400_000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  if (hr < 24) return `${hr} giờ trước`;
  if (day < 7) return `${day} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function PostCard({ post, userId, isAdmin, open }: { post: ClanPost; userId: string; isAdmin: boolean; open: () => void }) {
  const mine = post.author_id === userId;
  return (
    <button type="button" className={`card post-card t-${post.type}${post.status === "hidden" ? " hidden-post" : ""}${post.status === "pending" ? " pending" : post.pinned ? " pinned" : ""}`} onClick={open}>
      <span style={{ minWidth: 0, flex: 1 }}>
        {post.title && <b className="ell">{post.pinned && "📌 "}{post.title}</b>}
        <span className="post-body">{post.body}</span>
        <span className="tiny" style={{ margin: "4px 0 0" }}>
          <span className="post-type">{TYPE_LABEL[post.type]}</span> {relative(post.created_at)}
          {(mine || isAdmin) && ` · ${mine ? "bạn" : post.author_id.slice(0, 8)}`}
          {post.status === "pending" && <span className="post-pending"> · Chờ duyệt</span>}
          {post.status === "hidden" && " · Đã ẩn"}
        </span>
      </span>
      <span className="go"><IconArrowRight /></span>
    </button>
  );
}

// ─── Danh sách ─────────────────────────────────────────────────────────

export function BoardScreen({
  clan,
  userId,
  openPost,
}: {
  clan: ClanSummary;
  userId: string;
  openPost: (id: string) => void;
}) {
  const rev = useRev();
  const isAdmin = clan.role === "admin";
  const [pages, setPages] = useState(1);
  const posts = useAsync(() => listClanPosts(clan.id, { page: 1, pageSize: PAGE_SIZE * pages }), [clan.id, pages, rev]);
  const rows = posts.data?.rows ?? [];
  const total = posts.data?.total ?? 0;

  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>Tin tức, sự kiện, sinh, mất, thông báo — cho cả họ cùng đọc.</p>

      {posts.loading && !posts.data && [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 96, marginBottom: 8 }} />)}
      {posts.error && <p className="error">{posts.error}</p>}
      {posts.data && total === 0 && (
        <div className="card empty"><p className="muted">Chưa có bài viết nào.</p></div>
      )}
      {rows.map((p) => <PostCard key={p.id} post={p} userId={userId} isAdmin={isAdmin} open={() => openPost(p.id)} />)}
      {rows.length < total && (
        <button type="button" className="btn ghost block" disabled={posts.loading} onClick={() => setPages((n) => n + 1)}>
          {posts.loading ? "Đang tải…" : `Xem thêm (còn ${total - rows.length} bài)`}
        </button>
      )}
    </div>
  );
}

// ─── Chi tiết ──────────────────────────────────────────────────────────

export function PostScreen({
  userId,
  postId,
  openPerson,
}: {
  userId: string;
  postId: string;
  openPerson: (id: string) => void;
}) {
  const rev = useRev();
  const q = useAsync(() => getClanPost(postId), [postId, rev]);
  const comments = useAsync(() => listCommentsForPost(postId), [postId, rev]);
  const post = q.data;

  if (q.loading && !post) return <div className="page"><div className="sk" style={{ height: 240 }} /></div>;
  if (q.error || !post) {
    return <div className="center"><p className="error">{q.error ?? "Không thấy bài. Có thể đã bị ẩn hoặc bạn không có quyền xem."}</p></div>;
  }
  const mine = post.author_id === userId;

  return (
    <div className="page">
      <section className="card pane">
        <p className="tiny" style={{ margin: "0 0 6px" }}>
          <span className="post-type">{TYPE_LABEL[post.type]}</span>
          {post.pinned && " · 📌 Đã ghim"}
          {post.status === "pending" && <span className="post-pending"> · Chờ duyệt</span>}
          {post.status === "hidden" && " · Đã ẩn"}
        </p>
        {post.title && <h2 className="serif" style={{ margin: "0 0 4px", fontSize: 20 }}>{post.title}</h2>}
        <p className="tiny" style={{ margin: "0 0 10px" }}>
          {new Date(post.created_at).toLocaleString("vi-VN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}{mine ? "bạn" : post.author_id.slice(0, 8)}
        </p>
        <div className="post-full">{post.body}</div>
        {post.event_date && <p className="note">Ngày diễn ra: <b>{new Date(post.event_date).toLocaleDateString("vi-VN")}</b></p>}
        {post.person_id && (
          <button type="button" className="btn text" style={{ padding: 0, minHeight: 0, marginTop: 8 }} onClick={() => openPerson(post.person_id!)}>
            Xem trang người liên quan →
          </button>
        )}
      </section>

      <h3 className="grouptitle">Bình luận ({comments.data?.length ?? 0})</h3>
      <div className="card group">
        {comments.loading && !comments.data && <div className="sk" style={{ height: 60, margin: 10 }} />}
        {(comments.data ?? []).map((c) => (
          <div key={c.id} className="grow comment">
            <span className="tiny" style={{ margin: 0 }}>
              {c.author_id === userId ? "bạn" : c.author_id.slice(0, 8)} · {new Date(c.created_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
              {c.status === "hidden" && " · Đã ẩn"}
            </span>
            <span className="post-full" style={{ fontSize: 14 }}>{c.body}</span>
          </div>
        ))}
        {comments.data && comments.data.length === 0 && <p className="note" style={{ margin: 14 }}>Chưa có bình luận.</p>}
      </div>
    </div>
  );
}
