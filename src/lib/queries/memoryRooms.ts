import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import type { GalleryPhoto } from "@/lib/queries/galleryPhotos";

// Bảng memory_rooms/items chưa có trong database.types.ts (sẽ regen trước khi
// áp prod) → dùng client không kiểu cho riêng module này.
const db = supabase as unknown as SupabaseClient;

export type MemoryRoom = {
  id: string;
  clan_id: string;
  name: string;
  description: string | null;
  theme: string;
  cover_image_url: string | null;
  is_public: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type MemoryRoomItem = {
  id: string;
  room_id: string;
  kind: "photo" | "model";
  person_id: string | null;
  image_url: string | null;
  image_path: string | null;
  model_url: string | null;
  caption: string | null;
  subtitle: string | null;
  sort: number;
  person?: {
    id: string;
    full_name: string;
    birth_date: string | null;
    death_date: string | null;
    photo_path: string | null;
  } | null;
};

/** Ảnh đã resolve để dựng phòng, kèm khoá item để sửa (admin). */
export type RoomGalleryPhoto = GalleryPhoto & {
  itemId: string;
  personId: string | null;
};

const year = (d: string | null | undefined) => (d ? d.slice(0, 4) : "");

export async function listMemoryRooms(clanId: string): Promise<MemoryRoom[]> {
  const { data, error } = await db
    .from("memory_rooms")
    .select("*")
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemoryRoom[];
}

export async function getMemoryRoom(roomId: string): Promise<MemoryRoom | null> {
  const { data, error } = await db
    .from("memory_rooms")
    .select("*")
    .eq("id", roomId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MemoryRoom) ?? null;
}

export async function createMemoryRoom(
  clanId: string,
  input: { name: string; theme?: string; description?: string },
): Promise<MemoryRoom> {
  const { data, error } = await db
    .from("memory_rooms")
    .insert({
      clan_id: clanId,
      name: input.name,
      theme: input.theme ?? "white",
      description: input.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MemoryRoom;
}

export async function updateMemoryRoom(
  roomId: string,
  patch: Partial<Pick<MemoryRoom, "name" | "theme" | "description">>,
): Promise<void> {
  const { error } = await db.from("memory_rooms").update(patch).eq("id", roomId);
  if (error) throw new Error(error.message);
}

/** Xoá mềm (deleted_at). */
export async function deleteMemoryRoom(roomId: string): Promise<void> {
  const { error } = await db
    .from("memory_rooms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", roomId);
  if (error) throw new Error(error.message);
}

/** Nạp ảnh từ danh sách thành viên (chỉ người có ảnh) qua RPC. */
export async function seedRoomFromMembers(roomId: string): Promise<number> {
  const { data, error } = await db.rpc("seed_memory_room_from_members", {
    p_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Thành viên CÓ ẢNH của dòng họ — cho bộ chọn "đổi ảnh thành viên". */
export type ClanMemberPhoto = {
  id: string;
  full_name: string;
  photo_path: string;
};
export async function listClanMembersWithPhotos(
  clanId: string,
): Promise<ClanMemberPhoto[]> {
  const { data, error } = await db
    .from("persons")
    .select("id, full_name, photo_path")
    .eq("clan_id", clanId)
    .not("photo_path", "is", null)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanMemberPhoto[];
}

export async function getRoomItems(roomId: string): Promise<MemoryRoomItem[]> {
  const { data, error } = await db
    .from("memory_room_items")
    .select(
      "*, person:persons(id, full_name, birth_date, death_date, photo_path)",
    )
    .eq("room_id", roomId)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemoryRoomItem[];
}

export async function updateRoomItem(
  itemId: string,
  patch: {
    person_id?: string | null;
    image_url?: string | null;
    caption?: string | null;
  },
): Promise<void> {
  const { error } = await db
    .from("memory_room_items")
    .update(patch)
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

/**
 * Resolve item → ảnh dựng phòng: thành viên thì ký URL từ photo_path (không lưu
 * URL), dán ngoài thì dùng thẳng image_url. Chỉ giữ item ảnh có nguồn hiển thị.
 */
export async function resolveRoomPhotos(
  roomId: string,
): Promise<RoomGalleryPhoto[]> {
  const items = (await getRoomItems(roomId)).filter((i) => i.kind === "photo");
  const paths = items
    .map((i) => (i.person_id ? i.person?.photo_path : null))
    .filter((p): p is string => !!p);
  const urlMap = await getSignedPhotoUrlMap(paths);

  const out: RoomGalleryPhoto[] = [];
  for (const it of items) {
    const p = it.person;
    const url = it.person_id
      ? p?.photo_path
        ? (urlMap.get(p.photo_path) ?? "")
        : ""
      : (it.image_url ?? "");
    if (!url) continue;
    const subtitle =
      it.subtitle ??
      [year(p?.birth_date), year(p?.death_date)].filter(Boolean).join(" – ");
    out.push({
      id: it.id,
      itemId: it.id,
      personId: it.person_id,
      path: it.person_id ? (p?.photo_path ?? "") : "",
      url,
      title: it.caption ?? p?.full_name ?? "Ảnh kỷ niệm",
      subtitle,
    });
  }
  return out;
}
