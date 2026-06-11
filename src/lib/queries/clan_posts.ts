import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type ClanPostType = "news" | "event" | "birth" | "death" | "notice";
export type ClanPostStatus = "published" | "pending" | "hidden";
export type ClanCommentStatus = "published" | "hidden";
export type ClanPostModerateAction =
  | "publish"
  | "reject"
  | "hide"
  | "unhide"
  | "pin"
  | "unpin";

export interface ClanPost {
  id: string;
  clan_id: string;
  author_id: string;
  type: ClanPostType;
  title: string | null;
  body: string;
  person_id: string | null;
  event_id: string | null;
  event_date: string | null;
  status: ClanPostStatus;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClanPostComment {
  id: string;
  post_id: string;
  clan_id: string;
  author_id: string;
  body: string;
  status: ClanCommentStatus;
  created_at: string;
}

const POST_COLUMNS =
  "id, clan_id, author_id, type, title, body, person_id, event_id, event_date, status, pinned, created_at, updated_at";

const COMMENT_COLUMNS =
  "id, post_id, clan_id, author_id, body, status, created_at";

/**
 * Bảng tin clan — RLS lọc theo member + status. Sắp xếp: pinned trước,
 * sau đó mới nhất trước. UI dùng cho `/clan/:id/bang-tin`.
 *
 * Bao gồm cả `pending` của chính author (RLS cho phép) — cho phép tự
 * xem lại bài đang chờ duyệt.
 */
export async function listClanPosts(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanPost[]> {
  const { data, error } = await client
    .from("clan_posts")
    .select(POST_COLUMNS)
    .eq("clan_id", clanId)
    .neq("status", "hidden")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanPost[];
}

/**
 * Queue duyệt cho admin clan — chỉ bài `pending`. Hidden không vào
 * queue (đã từ chối).
 */
export async function listPendingPosts(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanPost[]> {
  const { data, error } = await client
    .from("clan_posts")
    .select(POST_COLUMNS)
    .eq("clan_id", clanId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanPost[];
}

/**
 * Bài đã `published` đính kèm 1 person (cáo phó/sinh) — hiện ở
 * PersonDetail làm "Tin liên quan". RLS đã chặn cross-clan + ẩn bài
 * pending/hidden cho non-author.
 */
export async function listPostsForPerson(
  personId: string,
  limit = 5,
  client: Client = defaultClient,
): Promise<ClanPost[]> {
  const { data, error } = await client
    .from("clan_posts")
    .select(POST_COLUMNS)
    .eq("person_id", personId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanPost[];
}

/**
 * Bài type='event'/'notice' có `event_date` trong cửa sổ [from, to].
 * Today.tsx dùng để gom vào danh sách sự kiện sắp tới.
 */
export async function listUpcomingEventPosts(
  clanId: string,
  fromIso: string,
  toIso: string,
  client: Client = defaultClient,
): Promise<ClanPost[]> {
  const { data, error } = await client
    .from("clan_posts")
    .select(POST_COLUMNS)
    .eq("clan_id", clanId)
    .eq("status", "published")
    .in("type", ["event", "notice"])
    .gte("event_date", fromIso)
    .lte("event_date", toIso)
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanPost[];
}

export async function getClanPost(
  id: string,
  client: Client = defaultClient,
): Promise<ClanPost | null> {
  const { data, error } = await client
    .from("clan_posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ClanPost) ?? null;
}

export interface CreatePostInput {
  clanId: string;
  authorId: string;
  type: ClanPostType;
  title?: string | null;
  body: string;
  personId?: string | null;
  eventId?: string | null;
  eventDate?: string | null;
  /** Quan trọng: non-admin BUỘC truyền 'pending'; admin có thể 'published'. */
  status: ClanPostStatus;
}

export async function createClanPost(
  input: CreatePostInput,
  client: Client = defaultClient,
): Promise<ClanPost> {
  const { data, error } = await client
    .from("clan_posts")
    .insert({
      clan_id: input.clanId,
      author_id: input.authorId,
      type: input.type,
      title: input.title ?? null,
      body: input.body,
      person_id: input.personId ?? null,
      event_id: input.eventId ?? null,
      event_date: input.eventDate ?? null,
      status: input.status,
    })
    .select(POST_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as ClanPost;
}

export interface UpdatePostPatch {
  title?: string | null;
  body?: string;
  type?: ClanPostType;
  person_id?: string | null;
  event_id?: string | null;
  event_date?: string | null;
}

/**
 * Sửa nội dung bài. RLS cho author của bài (đã pending) hoặc admin.
 * KHÔNG đổi status/pinned ở đây — dùng `moderateClanPost` cho mục đó
 * (trigger guard sẽ chặn dù policy cho UPDATE).
 */
export async function updateClanPost(
  id: string,
  patch: UpdatePostPatch,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("clan_posts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function moderateClanPost(
  postId: string,
  action: ClanPostModerateAction,
  note?: string | null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("clan_post_moderate", {
    p_post_id: postId,
    p_action: action,
    p_note: note ?? undefined,
  });
  if (error) throw new Error(error.message);
}

// ─── Comments ──────────────────────────────────────────────────────

export async function listCommentsForPost(
  postId: string,
  client: Client = defaultClient,
): Promise<ClanPostComment[]> {
  const { data, error } = await client
    .from("clan_post_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanPostComment[];
}

export async function createComment(
  postId: string,
  body: string,
  client: Client = defaultClient,
): Promise<void> {
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) throw new Error("Not authenticated");
  // clan_id sẽ được trigger `clan_post_comments_sync_clan` ép server-side.
  // Pass placeholder UUID — trigger ghi đè trước khi insert.
  const { error } = await client.from("clan_post_comments").insert({
    post_id: postId,
    clan_id: "00000000-0000-0000-0000-000000000000",
    author_id: authData.user.id,
    body,
  });
  if (error) throw new Error(error.message);
}

// ─── Audit log ─────────────────────────────────────────────────────

export interface ClanPostAuditRow {
  id: number;
  post_id: string;
  actor_id: string;
  action: string;
  old_status: ClanPostStatus | null;
  new_status: ClanPostStatus | null;
  note: string | null;
  created_at: string;
}

export async function listAuditForPost(
  postId: string,
  client: Client = defaultClient,
): Promise<ClanPostAuditRow[]> {
  const { data, error } = await client
    .from("clan_post_audit")
    .select("id, post_id, actor_id, action, old_status, new_status, note, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanPostAuditRow[];
}
