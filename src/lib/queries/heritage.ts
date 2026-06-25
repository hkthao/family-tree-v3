import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { deletePersonPhoto } from "@/lib/photoUpload";

type Client = SupabaseClient<Database>;

/** Trần dung lượng media (ảnh + ghi âm) mỗi dòng họ — VPS ít storage. */
export const HERITAGE_CLAN_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB

/** Định dạng dung lượng gọn: "42 MB", "1.2 GB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// ─── Bảo mật link ngoài ──────────────────────────────────────────
// Link ngoài do người dùng dán → phải kiểm tra để tránh XSS
// (javascript:/data:/vbscript:) và chỉ nhúng iframe từ nguồn tin cậy.

/** Chỉ chấp nhận URL https hợp lệ (chặn mọi scheme nguy hiểm + mixed content). */
export function isSafeHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  return u.protocol === "https:";
}

/**
 * Trả URL nhúng (embed) an toàn cho YouTube/Vimeo — CHỈ host trong danh
 * sách trắng mới được iframe. Trả null nếu không phải (caller sẽ dùng thẻ
 * <video> cho link file trực tiếp thay vì iframe bừa bãi).
 */
export function videoEmbedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v");
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
  }
  if (host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v");
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (/^[\w-]{11}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  return null;
}

/** Kiểm tra link người dùng dán theo loại; trả lỗi tiếng Việt nếu không hợp lệ. */
export function validateExternalMedia(
  kind: HeritageMediaKind,
  raw: string,
): { ok: true } | { ok: false; error: string } {
  const url = raw.trim();
  if (!url) return { ok: false, error: "Hãy dán đường link." };
  if (!isSafeHttpsUrl(url)) {
    return { ok: false, error: "Link phải bắt đầu bằng https:// và là địa chỉ hợp lệ." };
  }
  if (kind === "video" && !videoEmbedUrl(url)) {
    // Ngoài YouTube/Vimeo chỉ cho phép link file video https trực tiếp.
    if (!/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url)) {
      return { ok: false, error: "Video chỉ hỗ trợ YouTube, Vimeo, hoặc link file .mp4/.webm." };
    }
  }
  return { ok: true };
}

export type HeritageCategory = "place" | "custom" | "story" | "artifact";
export type HeritageStatus = "active" | "draft" | "archived";
export type HeritageMediaKind = "photo" | "audio" | "video";

export const HERITAGE_CATEGORY_LABEL: Record<HeritageCategory, string> = {
  place: "Từ đường / đền / chùa",
  custom: "Tục lệ / gia phong",
  story: "Giai thoại / công trạng",
  artifact: "Tư liệu / kỷ vật",
};

/** Mô tả ngắn gọi mời nhập (đặt dưới tiêu đề ở form). */
export const HERITAGE_CATEGORY_HINT: Record<HeritageCategory, string> = {
  place: "Nơi thờ tự của dòng họ: từ đường, nhà thờ họ, đền, chùa gửi giỗ…",
  custom: "Lệ giỗ, gia phong, văn khấn, hương ước, cách xưng hô trong họ…",
  story: "Truyền thuyết, công trạng, giai thoại về tổ tiên, người có công…",
  artifact: "Sắc phong, hoành phi, câu đối, gia phả cũ, kỷ vật quý của họ…",
};

/**
 * Câu hỏi gợi ý theo từng loại — DÀNH CHO NGƯỜI LỚN TUỔI: thay vì đối mặt
 * ô trống, các cụ chỉ cần lần lượt trả lời. Hiển thị làm placeholder /
 * gợi ý dưới ô nội dung.
 */
export const HERITAGE_CATEGORY_PROMPTS: Record<HeritageCategory, string[]> = {
  place: [
    "Từ đường / nơi thờ ở đâu?",
    "Lập (xây) năm nào? Ai đứng ra lập?",
    "Hiện ai trông coi, hương khói?",
    "Lễ chính trong năm vào ngày nào?",
  ],
  custom: [
    "Giỗ họ (hoặc lệ này) tổ chức vào ngày nào?",
    "Ai chủ trì, con cháu cần làm gì?",
    "Có lễ vật / món ăn / nghi thức gì bắt buộc?",
    "Vì sao họ ta giữ lệ này?",
  ],
  story: [
    "Chuyện kể về ai trong họ?",
    "Xảy ra vào khoảng thời gian nào?",
    "Diễn biến ra sao?",
    "Ý nghĩa / bài học muốn nhắn con cháu?",
  ],
  artifact: [
    "Đây là vật gì?",
    "Của ai, có từ đời nào?",
    "Vì sao quý với dòng họ?",
    "Hiện ai đang giữ / cất ở đâu?",
  ],
};

export interface HeritageItem {
  id: string;
  clan_id: string;
  category: HeritageCategory;
  title: string;
  summary: string | null;
  body: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  built_year: number | null;
  status: HeritageStatus;
  sort: number;
  cover_media_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeritageMedia {
  id: string;
  kind: HeritageMediaKind;
  /** Đường dẫn trong bucket (file tải lên) — null nếu là link ngoài. */
  path: string | null;
  /** Link ngoài (YouTube/URL ảnh/audio…) — null nếu là file tải lên. */
  external_url: string | null;
  caption: string | null;
  sort: number;
  bytes: number | null;
  duration_sec: number | null;
}

export interface HeritagePersonLink {
  link_id: string;
  person_id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  role_note: string | null;
}

export interface HeritageListItem extends HeritageItem {
  /** Ảnh đại diện: đường dẫn bucket (cần ký) — null nếu cover là link ngoài/không có. */
  cover_media_path: string | null;
  /** Ảnh đại diện là link ngoài (dùng trực tiếp). */
  cover_external_url: string | null;
  photo_count: number;
  audio_count: number;
  video_count: number;
  people_count: number;
}

export interface HeritageDetail extends HeritageItem {
  media: HeritageMedia[];
  people: HeritagePersonLink[];
}

const COLS =
  "id, clan_id, category, title, summary, body, location_name, address, latitude, longitude, built_year, status, sort, cover_media_id, created_by, created_at, updated_at";

export async function listHeritageItems(
  clanId: string,
  opts: { category?: HeritageCategory | null; search?: string } = {},
  client: Client = defaultClient,
): Promise<HeritageListItem[]> {
  let q = client
    .from("heritage_items")
    .select(
      `${COLS}, heritage_media!heritage_media_item_id_fkey(id, kind, path, external_url, sort), heritage_people(id)`,
    )
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const needle = (opts.search ?? "").trim().toLowerCase();
  return (data ?? [])
    .map((r) => {
      const media = (r.heritage_media ?? []) as {
        id: string;
        kind: HeritageMediaKind;
        path: string | null;
        external_url: string | null;
        sort: number;
      }[];
      const photos = media.filter((m) => m.kind === "photo").sort((a, b) => a.sort - b.sort);
      const coverPhoto = photos.find((p) => p.id === r.cover_media_id) ?? photos[0] ?? null;
      const { heritage_media, heritage_people, ...rest } = r;
      return {
        ...(rest as HeritageItem),
        cover_media_path: coverPhoto?.path ?? null,
        cover_external_url: coverPhoto?.external_url ?? null,
        photo_count: photos.length,
        audio_count: media.filter((m) => m.kind === "audio").length,
        video_count: media.filter((m) => m.kind === "video").length,
        people_count: (heritage_people ?? []).length,
      };
    })
    .filter((r) => {
      if (!needle) return true;
      const hay = `${r.title} ${r.summary ?? ""} ${r.body ?? ""} ${r.location_name ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
}

export async function getHeritageItem(
  id: string,
  client: Client = defaultClient,
): Promise<HeritageDetail | null> {
  const { data, error } = await client
    .from("heritage_items")
    .select(
      `${COLS},
       heritage_media!heritage_media_item_id_fkey(id, kind, path, external_url, caption, sort, bytes, duration_sec),
       heritage_people(id, role_note, person:persons(id, full_name, gender, is_living))`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { heritage_media, heritage_people, ...rest } = data;
  const media = ((heritage_media ?? []) as HeritageMedia[]).sort((a, b) => {
    // ảnh trước, audio sau; trong cùng loại theo sort
    if (a.kind !== b.kind) return a.kind === "photo" ? -1 : 1;
    return a.sort - b.sort;
  });
  const people: HeritagePersonLink[] = (heritage_people ?? [])
    .map((l) => {
      const p = (l as { person: { id: string; full_name: string; gender: "M" | "F"; is_living: boolean } | null }).person;
      if (!p) return null;
      return {
        link_id: l.id as string,
        person_id: p.id,
        full_name: p.full_name,
        gender: p.gender,
        is_living: p.is_living,
        role_note: (l.role_note as string | null) ?? null,
      };
    })
    .filter((x): x is HeritagePersonLink => x !== null);
  return { ...(rest as HeritageItem), media, people };
}

export type HeritageInput = Partial<
  Omit<HeritageItem, "id" | "clan_id" | "created_at" | "updated_at" | "cover_media_id" | "created_by">
> & { category: HeritageCategory; title: string };

export async function createHeritageItem(
  clanId: string,
  input: HeritageInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("heritage_items")
    .insert({ clan_id: clanId, ...input })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function updateHeritageItem(
  id: string,
  patch: Partial<HeritageInput> & { cover_media_id?: string | null },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("heritage_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Soft-delete (lọc khỏi read bằng deleted_at is null). */
export async function deleteHeritageItem(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("heritage_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

const PLACEHOLDER_CLAN = "00000000-0000-0000-0000-000000000000";

export async function addMedia(
  itemId: string,
  input: {
    kind: HeritageMediaKind;
    /** Một trong hai: file đã tải (path) hoặc link ngoài (external_url). */
    path?: string | null;
    external_url?: string | null;
    caption?: string | null;
    sort?: number;
    bytes?: number | null;
    duration_sec?: number | null;
  },
  client: Client = defaultClient,
): Promise<{ id: string }> {
  if (!input.path && !input.external_url) {
    throw new Error("Thiếu nguồn media (file hoặc link).");
  }
  const { data, error } = await client
    .from("heritage_media")
    .insert({
      item_id: itemId,
      clan_id: PLACEHOLDER_CLAN, // synced by trigger
      kind: input.kind,
      path: input.path ?? null,
      external_url: input.external_url ?? null,
      caption: input.caption ?? null,
      sort: input.sort ?? 0,
      // Link ngoài không tính dung lượng (bytes = null).
      bytes: input.path ? input.bytes ?? null : null,
      duration_sec: input.duration_sec ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function removeMedia(
  mediaId: string,
  path: string | null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("heritage_media").delete().eq("id", mediaId);
  if (error) throw new Error(error.message);
  // Chỉ dọn storage cho file đã tải; link ngoài không có gì để xoá.
  if (path) await deletePersonPhoto(path).catch(() => {});
}

export async function reorderMedia(
  updates: { id: string; sort: number }[],
  client: Client = defaultClient,
): Promise<void> {
  for (const u of updates) {
    const { error } = await client
      .from("heritage_media")
      .update({ sort: u.sort })
      .eq("id", u.id);
    if (error) throw new Error(error.message);
  }
}

export async function setCoverMedia(
  itemId: string,
  mediaId: string | null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("heritage_items")
    .update({ cover_media_id: mediaId })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function addHeritagePerson(
  itemId: string,
  personId: string,
  roleNote: string | null = null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("heritage_people").insert({
    item_id: itemId,
    person_id: personId,
    clan_id: PLACEHOLDER_CLAN, // synced by trigger
    role_note: roleNote,
  });
  if (error) throw new Error(error.message);
}

export async function removeHeritagePerson(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("heritage_people").delete().eq("id", linkId);
  if (error) throw new Error(error.message);
}

/** Mục di sản gắn một người — cho liên kết ở PersonDetail. */
export async function getHeritageItemsForPerson(
  personId: string,
  client: Client = defaultClient,
): Promise<{ id: string; category: HeritageCategory; title: string }[]> {
  const { data, error } = await client
    .from("heritage_people")
    .select("item:heritage_items(id, category, title, deleted_at)")
    .eq("person_id", personId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((l) => (l as { item: { id: string; category: HeritageCategory; title: string; deleted_at: string | null } | null }).item)
    .filter((i): i is { id: string; category: HeritageCategory; title: string; deleted_at: string | null } => !!i && !i.deleted_at)
    .map(({ deleted_at, ...rest }) => rest);
}

/** Tổng dung lượng media của clan (bytes) — để hiển thị & cảnh báo giới hạn. */
export async function clanHeritageStorageBytes(
  clanId: string,
  client: Client = defaultClient,
): Promise<number> {
  const { data, error } = await client
    .from("heritage_media")
    .select("bytes")
    .eq("clan_id", clanId);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, r) => sum + ((r.bytes as number | null) ?? 0), 0);
}

/** Build "chỉ đường" Google Maps URL (null nếu không có toạ độ). */
export function heritageDirectionsUrl(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
