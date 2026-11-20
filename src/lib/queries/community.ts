import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";

/**
 * Đóng góp cộng đồng (docs/plan-dong-gop-cong-dong.md — P0): ký ức gắn người, link mời góp,
 * số liệu "Đóng góp mới", lượt ghé thăm. Thành viên ghi thẳng (RLS + trigger quyết trạng thái);
 * khách đi qua edge function community-submit.
 */

type Client = SupabaseClient<Database>;

/** Một lần "đưa vào gia phả": vào đâu, ai làm, khi nào (mark_memory_applied / duyệt đề xuất). */
export interface AppliedTarget {
  type: "bio" | "photo" | "manual" | "contribution";
  person_id?: string | null;
  contribution_id?: string;
  contribution_type?: string;
  note?: string | null;
  by?: string | null;
  at?: string;
}

export type MemoryKind = "story" | "photo" | "audio" | "answer";
export type MemoryStatus = "pending" | "visible" | "hidden";
export type MemoryVisibility = "clan" | "share";
export type MemoryModeration = "pre" | "post";

export interface PersonMemory {
  id: string;
  clan_id: string;
  person_id: string | null;
  kind: MemoryKind;
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
  duration_sec: number | null;
  year_approx: number | null;
  place: string | null;
  source: string | null;
  author_user_id: string | null;
  /** Tên hiển thị: thành viên → display_name, khách → tên tự ghi. */
  author_label: string;
  author_relation: string | null;
  is_guest: boolean;
  visibility: MemoryVisibility;
  status: MemoryStatus;
  created_at: string;
  /** URL ký (tệp trong bucket) hoặc link ngoài https (external_url). */
  media_url: string | null;
  /** true = media là link ngoài (Google Photos, Drive, YouTube…), không phải tệp của server. */
  is_external: boolean;
  /** Ảnh "nhờ cả nhà nhận diện" (P2). */
  identify: boolean;
  /** Là câu trả lời cho câu hỏi (P1) — kèm nội dung câu hỏi để hiện phía trên. */
  question_id: string | null;
  question_text: string | null;
  /** Đã đưa vào gia phả ở đâu (rỗng = chưa). */
  applied: AppliedTarget[];
  person_name?: string | null;
}

const MEMORY_SELECT =
  "id, clan_id, person_id, kind, body, media_path, media_mime, external_url, identify, question_id, applied_to, duration_sec, year_approx, place, source, author_user_id, author_name, author_relation, visibility, status, created_at, author:profiles!person_memories_author_user_id_fkey(display_name), person:persons(full_name), question:family_questions!person_memories_question_fk(question)";

interface MemoryRow {
  id: string;
  clan_id: string;
  person_id: string | null;
  kind: string;
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
  external_url: string | null;
  identify: boolean;
  question_id: string | null;
  question: { question: string } | null;
  applied_to: AppliedTarget[] | null;
  duration_sec: number | null;
  year_approx: number | null;
  place: string | null;
  source: string | null;
  author_user_id: string | null;
  author_name: string | null;
  author_relation: string | null;
  visibility: string;
  status: string;
  created_at: string;
  author: { display_name: string | null } | null;
  person: { full_name: string } | null;
}

async function hydrate(rows: MemoryRow[]): Promise<PersonMemory[]> {
  const urls = await getSignedPhotoUrlMap(
    rows.map((r) => r.media_path).filter((p): p is string => !!p),
  );
  return rows.map((r) => ({
    id: r.id,
    clan_id: r.clan_id,
    person_id: r.person_id,
    kind: r.kind as MemoryKind,
    body: r.body,
    media_path: r.media_path,
    media_mime: r.media_mime,
    duration_sec: r.duration_sec,
    year_approx: r.year_approx,
    place: r.place,
    source: r.source,
    author_user_id: r.author_user_id,
    author_label: r.author?.display_name || r.author_name || "Người thân",
    author_relation: r.author_relation,
    is_guest: !r.author_user_id,
    visibility: r.visibility as MemoryVisibility,
    status: r.status as MemoryStatus,
    created_at: r.created_at,
    media_url: r.media_path ? (urls.get(r.media_path) ?? null) : r.external_url,
    is_external: !r.media_path && !!r.external_url,
    identify: !!r.identify,
    question_id: r.question_id,
    question_text: r.question?.question ?? null,
    applied: Array.isArray(r.applied_to) ? r.applied_to : [],
    person_name: r.person?.full_name ?? null,
  }));
}

/** Ký ức về một người. RLS: thành viên thấy bài hiện + bài của mình; editor+ thấy cả chờ / ẩn. */
export async function listPersonMemories(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonMemory[]> {
  const { data, error } = await client
    .from("person_memories")
    .select(MEMORY_SELECT)
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return hydrate((data ?? []) as unknown as MemoryRow[]);
}

/** Mọi ký ức của họ mà người xem được phép thấy (trang "Đóng góp nội dung"); lọc / phân trang ở client. */
export async function listClanMemories(
  clanId: string,
  client: Client = defaultClient,
): Promise<PersonMemory[]> {
  const { data, error } = await client
    .from("person_memories")
    .select(MEMORY_SELECT)
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return hydrate((data ?? []) as unknown as MemoryRow[]);
}

export interface PersonCommunityInfo {
  /** Số đóng góp người xem thấy được (editor+: gồm cả chờ / ẩn). */
  total: number;
  pending: number;
  /** Đóng góp mới nhất — để admin đọc lướt ngay ở Danh bạ. */
  latest: { excerpt: string; author: string; created_at: string } | null;
}

/**
 * Tóm tắt đóng góp theo từng người cho Danh bạ: số lượng, số chờ duyệt, đoạn mới nhất.
 * Một truy vấn cho cả họ (RLS lọc theo vai trò), gom ở client.
 */
export async function getCommunityInfoByPerson(
  clanId: string,
  client: Client = defaultClient,
): Promise<Map<string, PersonCommunityInfo>> {
  const { data, error } = await client
    .from("person_memories")
    .select(
      "person_id, status, kind, body, author_name, created_at, author:profiles!person_memories_author_user_id_fkey(display_name)",
    )
    .eq("clan_id", clanId)
    .not("person_id", "is", null)
    .neq("status", "hidden")
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) throw new Error(error.message);
  const out = new Map<string, PersonCommunityInfo>();
  for (const r of (data ?? []) as unknown as {
    person_id: string;
    status: string;
    kind: string;
    body: string | null;
    author_name: string | null;
    created_at: string;
    author: { display_name: string | null } | null;
  }[]) {
    let info = out.get(r.person_id);
    if (!info) {
      info = { total: 0, pending: 0, latest: null };
      out.set(r.person_id, info);
    }
    info.total += 1;
    if (r.status === "pending") info.pending += 1;
    if (!info.latest) {
      const excerpt =
        r.body?.trim().replace(/\s+/g, " ") ||
        (r.kind === "photo" ? "(một tấm ảnh)" : r.kind === "audio" ? "(một đoạn ghi âm)" : "");
      info.latest = {
        excerpt,
        author: r.author?.display_name || r.author_name || "Người thân",
        created_at: r.created_at,
      };
    }
  }
  return out;
}

/** Hàng chờ duyệt của cả họ (chỉ editor+ đọc được các dòng pending). */
export async function listPendingMemories(
  clanId: string,
  client: Client = defaultClient,
): Promise<PersonMemory[]> {
  const { data, error } = await client
    .from("person_memories")
    .select(MEMORY_SELECT)
    .eq("clan_id", clanId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return hydrate((data ?? []) as unknown as MemoryRow[]);
}

export interface CreateMemoryInput {
  clan_id: string;
  person_id: string | null;
  kind: MemoryKind;
  body?: string | null;
  media_path?: string | null;
  media_mime?: string | null;
  external_url?: string | null;
  identify?: boolean;
  question_id?: string | null;
  duration_sec?: number | null;
  year_approx?: number | null;
  place?: string | null;
  source?: string | null;
  author_relation?: string | null;
  visibility?: MemoryVisibility;
  allow_ai_reuse?: boolean;
}

/** Thành viên thêm ký ức. Tác giả + trạng thái do trigger đặt (theo vai trò và cài đặt họ). */
export async function createMemory(
  input: CreateMemoryInput,
  client: Client = defaultClient,
): Promise<{ id: string; status: MemoryStatus }> {
  const { data, error } = await client
    .from("person_memories")
    .insert({
      clan_id: input.clan_id,
      person_id: input.person_id,
      kind: input.kind,
      body: input.body?.trim() || null,
      media_path: input.media_path ?? null,
      media_mime: input.media_mime ?? null,
      external_url: input.external_url?.trim() || null,
      identify: input.identify ?? false,
      question_id: input.question_id ?? null,
      duration_sec: input.duration_sec ?? null,
      year_approx: input.year_approx ?? null,
      place: input.place?.trim() || null,
      source: input.source?.trim() || null,
      author_relation: input.author_relation?.trim() || null,
      visibility: input.visibility ?? "clan",
      allow_ai_reuse: input.allow_ai_reuse ?? true,
    })
    .select("id, status")
    .single();
  if (error) throw new Error(error.message);
  notifyMemory(data.id);
  return { id: data.id, status: data.status as MemoryStatus };
}

/**
 * Báo người quản lý có đóng góp mới (gom tối đa 1 lần / họ / giờ) và báo người đặt câu hỏi khi có
 * câu trả lời — gọi notify-contribution kiểu "bắn rồi quên", lỗi gửi không ảnh hưởng việc lưu.
 */
function notifyMemory(id: string): void {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return;
  fetch(`${base}/functions/v1/notify-contribution`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ memory_id: id }),
  }).catch(() => {
    /* thông báo là phụ */
  });
}

export async function setMemoryStatus(
  id: string,
  status: MemoryStatus,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("person_memories").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMemory(
  memory: Pick<PersonMemory, "id" | "media_path">,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("person_memories").delete().eq("id", memory.id);
  if (error) throw new Error(error.message);
  // Tệp: thành viên chỉ xoá được tệp của mình (policy storage); tệp của khách để lại cho dọn dẹp.
  if (memory.media_path) {
    await client.storage.from("person-photos").remove([memory.media_path]);
  }
}

// ─── Số liệu "Đóng góp mới" ───────────────────────────────────

export interface CommunityRecentItem {
  type: "memory" | "contribution";
  id: string;
  kind: string;
  person_id: string | null;
  person_name: string | null;
  author_name: string | null;
  created_at: string;
}

export interface CommunitySummary {
  visits_week: number;
  visits_total: number;
  memories_week: number;
  contributors_week: number;
  pending_memories: number;
  pending_contributions: number;
  recent: CommunityRecentItem[];
}

export async function getCommunitySummary(
  clanId: string,
  client: Client = defaultClient,
): Promise<CommunitySummary> {
  const { data, error } = await client.rpc("clan_community_summary", { p_clan_id: clanId });
  if (error) throw new Error(error.message);
  return data as unknown as CommunitySummary;
}

/** Đếm lượt thành viên mở trang họ — tối đa 1 lần / họ / ngày / trình duyệt. */
export async function recordMemberVisit(
  clanId: string,
  client: Client = defaultClient,
): Promise<void> {
  const key = `visit:${clanId}`;
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
  } catch {
    /* không có localStorage → vẫn đếm */
  }
  await client.rpc("record_member_visit", { p_clan_id: clanId });
}

export async function setMemoryModeration(
  clanId: string,
  mode: MemoryModeration,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("clans").update({ memory_moderation: mode }).eq("id", clanId);
  if (error) throw new Error(error.message);
}

// ─── Link mời góp ───────────────────────────────────────────────

export interface ContributeLink {
  id: string;
  token: string;
  recipient_label: string | null;
  root_person_id: string | null;
  person_name: string | null;
  expires_at: string;
  is_revoked: boolean;
  use_count: number;
  /** Tự tạm dừng nhận đóng góp (quá nhiều trong 24 giờ — có thể link bị lộ). */
  contrib_paused_at: string | null;
  created_by: string | null;
  created_at: string;
}

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const CONTRIBUTE_LINK_TTL_DAYS = 30;

export async function createContributeLink(
  input: { clan_id: string; recipient_label?: string | null; root_person_id?: string | null; ttlDays?: number },
  client: Client = defaultClient,
): Promise<ContributeLink> {
  const ttl = Math.min(input.ttlDays ?? CONTRIBUTE_LINK_TTL_DAYS, 90);
  const { data: auth } = await client.auth.getUser();
  const { data, error } = await client
    .from("share_links")
    .insert({
      clan_id: input.clan_id,
      token: makeToken(),
      scope: "contribute",
      recipient_label: input.recipient_label?.trim() || null,
      root_person_id: input.root_person_id ?? null,
      created_by: auth.user?.id ?? null,
      expires_at: new Date(Date.now() + ttl * 86400_000).toISOString(),
    })
    .select(
      "id, token, recipient_label, root_person_id, expires_at, is_revoked, use_count, created_by, created_at, person:persons(full_name)",
    )
    .single();
  if (error) throw new Error(error.message);
  const { person, ...rest } = data as unknown as ContributeLink & { person: { full_name: string } | null };
  return { ...rest, person_name: person?.full_name ?? null };
}

/** Link mời góp: thành viên thấy link của mình; admin thấy mọi link của họ (policy admin cũ). */
export async function listContributeLinks(
  clanId: string,
  client: Client = defaultClient,
): Promise<ContributeLink[]> {
  const { data, error } = await client
    .from("share_links")
    .select(
      "id, token, recipient_label, root_person_id, expires_at, is_revoked, use_count, contrib_paused_at, created_by, created_at, person:persons(full_name)",
    )
    .eq("clan_id", clanId)
    .eq("scope", "contribute")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (ContributeLink & { person: { full_name: string } | null })[]).map(
    ({ person, ...rest }) => ({ ...rest, person_name: person?.full_name ?? null }),
  );
}

/** Mở lại link đã tự tạm dừng (người tạo link / admin). */
export async function resumeContributeLink(id: string, client: Client = defaultClient): Promise<void> {
  const { error } = await client.from("share_links").update({ contrib_paused_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function revokeContributeLink(id: string, client: Client = defaultClient): Promise<void> {
  const { error } = await client.from("share_links").update({ is_revoked: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export function contributeLinkUrl(token: string, personId?: string | null): string {
  const base = `${window.location.origin}/share/${token}?tab=gop`;
  return personId ? `${base}&p=${personId}` : base;
}

// ─── Khách góp qua link (edge function) ─────────────────────────

const GUEST_KEY = "community:guest-key";
const GUEST_PROFILE = "community:guest-profile";

/** Khoá ngẫu nhiên của trình duyệt khách — server băm theo họ để nhận ra khách quen. */
export function guestKey(): string {
  try {
    let k = localStorage.getItem(GUEST_KEY);
    if (!k) {
      k = makeToken();
      localStorage.setItem(GUEST_KEY, k);
    }
    return k;
  } catch {
    return "";
  }
}

export interface GuestProfile {
  name: string;
  relation: string;
}

export function readGuestProfile(): GuestProfile {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE);
    if (raw) return { name: "", relation: "", ...JSON.parse(raw) };
  } catch {
    /* bỏ qua */
  }
  return { name: "", relation: "" };
}

export function saveGuestProfile(p: GuestProfile): void {
  try {
    localStorage.setItem(GUEST_PROFILE, JSON.stringify(p));
  } catch {
    /* bỏ qua */
  }
}

export interface GuestMemoryInput {
  token: string;
  kind: "story" | "photo" | "audio";
  person_id: string | null;
  body?: string;
  author_name: string;
  author_relation?: string;
  year_approx?: number | null;
  place?: string;
  source?: string;
  allow_ai_reuse: boolean;
  file?: Blob | null;
  file_name?: string;
  /** Link https thay cho tệp (ảnh / ghi âm) — không tốn ổ cứng server. */
  external_url?: string;
  /** Trả lời câu hỏi (P1). */
  question_id?: string | null;
  /** Ô bẫy bot — luôn rỗng với người thật. */
  website?: string;
  elapsed_ms: number;
}

export async function submitGuestMemory(
  input: GuestMemoryInput,
): Promise<{ id: string; status: MemoryStatus }> {
  const fd = new FormData();
  fd.set("token", input.token);
  fd.set("kind", input.kind);
  if (input.person_id) fd.set("person_id", input.person_id);
  if (input.body) fd.set("body", input.body);
  fd.set("author_name", input.author_name);
  if (input.author_relation) fd.set("author_relation", input.author_relation);
  if (input.year_approx) fd.set("year_approx", String(input.year_approx));
  if (input.place) fd.set("place", input.place);
  if (input.source) fd.set("source", input.source);
  fd.set("allow_ai_reuse", input.allow_ai_reuse ? "1" : "0");
  fd.set("guest_key", guestKey());
  fd.set("website", input.website ?? "");
  fd.set("elapsed_ms", String(Math.round(input.elapsed_ms)));
  if (input.question_id) fd.set("question_id", input.question_id);
  if (input.external_url) fd.set("external_url", input.external_url);
  else if (input.file) fd.set("file", input.file, input.file_name ?? "file");

  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${base}/functions/v1/community-submit`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `community-submit (${res.status})`);
  return body as { id: string; status: MemoryStatus };
}

// ─── P1: Hỏi ông bà ─────────────────────────────────────────────

export type QuestionStatus = "open" | "answered" | "closed";

export interface FamilyQuestion {
  id: string;
  clan_id: string;
  question: string;
  status: QuestionStatus;
  about_person_id: string | null;
  about_person_name: string | null;
  ask_person_id: string | null;
  ask_person_name: string | null;
  asked_by: string | null;
  asked_by_name: string | null;
  answers: number;
  created_at: string;
}

/** Câu hỏi gợi ý — ngắn, dễ trả lời bằng một đoạn ghi âm, khơi chuyện ngày xưa. */
export const SUGGESTED_QUESTIONS: string[] = [
  "Ngày nhỏ ông/bà hay chơi trò gì?",
  "Quê mình ngày xưa trông như thế nào?",
  "Ông bà gặp nhau lần đầu ở đâu, thế nào?",
  "Hồi trẻ ông/bà làm nghề gì để sống?",
  "Món ăn nào làm ông/bà nhớ nhà nhất?",
  "Kỷ niệm đáng nhớ nhất về cha mẹ của ông/bà là gì?",
  "Ngày Tết ngày xưa nhà mình thường làm gì?",
  "Lời dặn nào của ông bà tổ tiên mà ông/bà nhớ nhất?",
  "Thời chiến tranh gia đình mình đã sống ra sao?",
  "Ông/bà có biết vì sao họ mình về sống ở quê này không?",
  "Cụ cao nhất mà ông/bà còn nhớ tên là ai, cụ là người thế nào?",
  "Có bài hát, câu ca dao nào ông/bà hay hát cho con cháu?",
];

/** Câu hỏi gợi ý của tuần — đổi mỗi tuần, cả họ cùng một câu. */
export function weeklyQuestion(now = new Date()): string {
  const week = Math.floor(now.getTime() / (7 * 86400_000));
  return SUGGESTED_QUESTIONS[week % SUGGESTED_QUESTIONS.length];
}

export async function listQuestions(clanId: string, client: Client = defaultClient): Promise<FamilyQuestion[]> {
  const { data, error } = await client
    .from("family_questions")
    .select(
      "id, clan_id, question, status, about_person_id, ask_person_id, asked_by, created_at, about:persons!family_questions_about_person_id_fkey(full_name), ask:persons!family_questions_ask_person_id_fkey(full_name), asker:profiles(display_name), answers:person_memories!person_memories_question_fk(count)",
    )
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as {
    id: string;
    clan_id: string;
    question: string;
    status: string;
    about_person_id: string | null;
    ask_person_id: string | null;
    asked_by: string | null;
    created_at: string;
    about: { full_name: string } | null;
    ask: { full_name: string } | null;
    asker: { display_name: string | null } | null;
    answers: { count: number }[];
  }[]).map((q) => ({
    id: q.id,
    clan_id: q.clan_id,
    question: q.question,
    status: q.status as QuestionStatus,
    about_person_id: q.about_person_id,
    about_person_name: q.about?.full_name ?? null,
    ask_person_id: q.ask_person_id,
    ask_person_name: q.ask?.full_name ?? null,
    asked_by: q.asked_by,
    asked_by_name: q.asker?.display_name ?? null,
    answers: q.answers?.[0]?.count ?? 0,
    created_at: q.created_at,
  }));
}

export async function createQuestion(
  input: { clan_id: string; question: string; about_person_id?: string | null; ask_person_id?: string | null },
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("family_questions")
    .insert({
      clan_id: input.clan_id,
      question: input.question.trim(),
      about_person_id: input.about_person_id ?? null,
      ask_person_id: input.ask_person_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function setQuestionStatus(id: string, status: QuestionStatus, client: Client = defaultClient) {
  const { error } = await client.from("family_questions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestion(id: string, client: Client = defaultClient) {
  const { error } = await client.from("family_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Link trả lời một câu hỏi: trang chia sẻ mở thẳng tab Cùng góp với câu hỏi đó. */
export function questionLinkUrl(token: string, questionId: string): string {
  return `${window.location.origin}/share/${token}?tab=gop&q=${questionId}`;
}

// ─── P2: Ảnh "đây là ai?" ───────────────────────────────────────

/**
 * TẠM TẮT (2026-11-20): ổ cứng server self-host không đủ để lưu ảnh tải lên, mà khoanh mặt chỉ làm
 * được trên ảnh tải lên (không vẽ khung lên ảnh Google Photos / Drive). Bật lại = đổi thành true;
 * bảng photo_faces, edge function (kind=face) và UI vẫn còn nguyên.
 */
export const PHOTO_IDENTIFY_ENABLED = false;

export type FaceStatus = "suggested" | "confirmed" | "rejected";

export interface PhotoFace {
  id: string;
  memory_id: string;
  /** [x, y, w, h] theo tỉ lệ 0..1 của ảnh. */
  box: [number, number, number, number];
  person_id: string | null;
  person_name: string | null;
  suggested_name: string | null;
  suggested_note: string | null;
  status: FaceStatus;
  tagger_label: string;
  tagged_by: string | null;
  created_at: string;
}

export async function listFaces(memoryId: string, client: Client = defaultClient): Promise<PhotoFace[]> {
  const { data, error } = await client
    .from("photo_faces")
    .select(
      "id, memory_id, box_x, box_y, box_w, box_h, person_id, suggested_name, suggested_note, status, tagged_by, tagger_name, created_at, person:persons(full_name), tagger:profiles!photo_faces_tagged_by_fkey(display_name)",
    )
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as {
    id: string;
    memory_id: string;
    box_x: number;
    box_y: number;
    box_w: number;
    box_h: number;
    person_id: string | null;
    suggested_name: string | null;
    suggested_note: string | null;
    status: string;
    tagged_by: string | null;
    tagger_name: string | null;
    created_at: string;
    person: { full_name: string } | null;
    tagger: { display_name: string | null } | null;
  }[]).map((f) => ({
    id: f.id,
    memory_id: f.memory_id,
    box: [f.box_x, f.box_y, f.box_w, f.box_h],
    person_id: f.person_id,
    person_name: f.person?.full_name ?? null,
    suggested_name: f.suggested_name,
    suggested_note: f.suggested_note,
    status: f.status as FaceStatus,
    tagger_label: f.tagger?.display_name || f.tagger_name || "Người thân",
    tagged_by: f.tagged_by,
    created_at: f.created_at,
  }));
}

export interface FaceInput {
  memory_id: string;
  box: [number, number, number, number];
  person_id?: string | null;
  suggested_name?: string | null;
  suggested_note?: string | null;
}

/** Thành viên khoanh mặt (editor+ gắn người trong cây → xác nhận luôn, do trigger quyết). */
export async function addFace(input: FaceInput, client: Client = defaultClient): Promise<void> {
  const [x, y, w, h] = input.box;
  const { error } = await client.from("photo_faces").insert({
    memory_id: input.memory_id,
    clan_id: "00000000-0000-0000-0000-000000000000", // trigger ghi đè từ ảnh
    box_x: x,
    box_y: y,
    box_w: w,
    box_h: h,
    person_id: input.person_id ?? null,
    suggested_name: input.suggested_name?.trim() || null,
    suggested_note: input.suggested_note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function setFaceStatus(id: string, status: FaceStatus, client: Client = defaultClient) {
  const { error } = await client.from("photo_faces").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFace(id: string, client: Client = defaultClient) {
  const { error } = await client.from("photo_faces").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Khách khoanh mặt qua link (edge function community-submit, kind=face). */
export async function submitGuestFace(
  input: FaceInput & { token: string; author_name: string; elapsed_ms: number; website?: string },
): Promise<void> {
  const fd = new FormData();
  fd.set("token", input.token);
  fd.set("kind", "face");
  fd.set("memory_id", input.memory_id);
  const [x, y, w, h] = input.box;
  fd.set("box_x", String(x));
  fd.set("box_y", String(y));
  fd.set("box_w", String(w));
  fd.set("box_h", String(h));
  if (input.person_id) fd.set("person_id", input.person_id);
  if (input.suggested_name) fd.set("suggested_name", input.suggested_name);
  if (input.suggested_note) fd.set("suggested_note", input.suggested_note);
  fd.set("author_name", input.author_name);
  fd.set("guest_key", guestKey());
  fd.set("website", input.website ?? "");
  fd.set("elapsed_ms", String(Math.round(input.elapsed_ms)));
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${base}/functions/v1/community-submit`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `community-submit (${res.status})`);
}

// ─── Đưa vào gia phả ────────────────────────────────────────────

export async function markMemoryApplied(
  memoryId: string,
  target: Omit<AppliedTarget, "by" | "at">,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("mark_memory_applied", {
    p_memory_id: memoryId,
    p_target: target as never,
  });
  if (error) throw new Error(error.message);
}

/** Nối một đoạn vào tiểu sử người (editor+, audit log ghi lại) rồi đánh dấu đóng góp đã dùng. */
export async function applyMemoryToBio(
  memoryId: string,
  personId: string,
  text: string,
  client: Client = defaultClient,
): Promise<void> {
  const { data: p, error: e1 } = await client.from("persons").select("bio").eq("id", personId).single();
  if (e1) throw new Error(e1.message);
  const bio = [p.bio?.trim(), text.trim()].filter(Boolean).join("\n\n");
  const { error: e2 } = await client.from("persons").update({ bio }).eq("id", personId);
  if (e2) throw new Error(e2.message);
  await markMemoryApplied(memoryId, { type: "bio", person_id: personId }, client);
}

/** Dùng ảnh của đóng góp (tệp trong bucket hoặc link https) làm ảnh đại diện. */
export async function applyMemoryAsPhoto(
  memory: Pick<PersonMemory, "id" | "media_path" | "media_url" | "is_external">,
  personId: string,
  client: Client = defaultClient,
): Promise<void> {
  const path = memory.media_path ?? (memory.is_external ? memory.media_url : null);
  if (!path) throw new Error("Đóng góp này không có ảnh");
  const { error } = await client.from("persons").update({ photo_path: path }).eq("id", personId);
  if (error) throw new Error(error.message);
  await markMemoryApplied(memory.id, { type: "photo", person_id: personId }, client);
}
