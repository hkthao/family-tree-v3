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
  /** URL ký (ảnh / ghi âm), có khi media_path có. */
  media_url: string | null;
  person_name?: string | null;
}

const MEMORY_SELECT =
  "id, clan_id, person_id, kind, body, media_path, media_mime, duration_sec, year_approx, place, source, author_user_id, author_name, author_relation, visibility, status, created_at, author:profiles!person_memories_author_user_id_fkey(display_name), person:persons(full_name)";

interface MemoryRow {
  id: string;
  clan_id: string;
  person_id: string | null;
  kind: string;
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
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
    media_url: r.media_path ? (urls.get(r.media_path) ?? null) : null,
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
  return { id: data.id, status: data.status as MemoryStatus };
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
      "id, token, recipient_label, root_person_id, expires_at, is_revoked, use_count, created_by, created_at, person:persons(full_name)",
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
  if (input.file) fd.set("file", input.file, input.file_name ?? "file");

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
