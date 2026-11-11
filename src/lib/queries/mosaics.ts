import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getSignedPhotoUrl, getSignedPhotoUrlMap } from "@/lib/photoUpload";

// Bảng clan_mosaics/tiles chưa có trong database.types.ts (sẽ regen sau khi áp
// migration) → dùng client không kiểu cho riêng module này.
const db = supabase as unknown as SupabaseClient;

export type Mosaic = {
  id: string;
  clan_id: string;
  title: string;
  description: string | null;
  status: "open" | "closed";
  max_per_member: number;
  cols: number;
  /** Tổng số ô của bức. */
  slots: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MosaicTile = {
  id: string;
  mosaic_id: string;
  user_id: string | null;
  person_id: string | null;
  photo_path: string;
  caption: string | null;
  /** Chỉ số ô trong lưới (0-based). */
  position: number;
  status: "approved" | "hidden";
  /** URL hiển thị (đã ký nếu ảnh trong bucket). */
  url: string | null;
};

export async function listMosaics(clanId: string): Promise<Mosaic[]> {
  const { data, error } = await db
    .from("clan_mosaics")
    .select("*")
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Mosaic[];
}

/** Bức kèm số mảnh và vài ảnh đầu để làm ảnh xem trước ở danh sách. */
export type MosaicSummary = Mosaic & { tileCount: number; previews: string[] };

export async function listMosaicSummaries(
  clanId: string,
): Promise<MosaicSummary[]> {
  const mosaics = await listMosaics(clanId);
  if (mosaics.length === 0) return [];
  const { data, error } = await db
    .from("clan_mosaic_tiles")
    .select("mosaic_id, photo_path, position")
    .in(
      "mosaic_id",
      mosaics.map((m) => m.id),
    )
    .lt("position", 4)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { mosaic_id: string; photo_path: string }[];
  const urls = await getSignedPhotoUrlMap(rows.map((r) => r.photo_path));
  // Đếm riêng từng bức (head) — tránh trần 1000 dòng của PostgREST.
  const counts = await Promise.all(
    mosaics.map(async (m) => {
      const { count } = await db
        .from("clan_mosaic_tiles")
        .select("id", { count: "exact", head: true })
        .eq("mosaic_id", m.id);
      return count ?? 0;
    }),
  );
  return mosaics.map((m, i) => ({
    ...m,
    tileCount: counts[i],
    previews: rows
      .filter((r) => r.mosaic_id === m.id)
      .map((r) => urls.get(r.photo_path))
      .filter((u): u is string => !!u),
  }));
}

export async function getMosaic(id: string): Promise<Mosaic | null> {
  const { data, error } = await db
    .from("clan_mosaics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Mosaic) ?? null;
}

export async function createMosaic(
  clanId: string,
  input: {
    title: string;
    description?: string | null;
    max_per_member?: number;
    cols?: number;
    slots?: number;
  },
): Promise<Mosaic> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("clan_mosaics")
    .insert({ clan_id: clanId, created_by: u.user?.id ?? null, ...input })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Mosaic;
}

export async function updateMosaic(
  id: string,
  patch: Partial<
    Pick<
      Mosaic,
      "title" | "description" | "status" | "max_per_member" | "cols" | "slots"
    >
  >,
): Promise<void> {
  const { error } = await db.from("clan_mosaics").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMosaic(id: string): Promise<void> {
  const { error } = await db.from("clan_mosaics").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listMosaicTiles(mosaicId: string): Promise<MosaicTile[]> {
  const { data, error } = await db
    .from("clan_mosaic_tiles")
    .select(
      "id, mosaic_id, user_id, person_id, photo_path, caption, position, status",
    )
    .eq("mosaic_id", mosaicId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<MosaicTile, "url">[];
  const urls = await getSignedPhotoUrlMap(rows.map((r) => r.photo_path));
  return rows.map((r) => ({ ...r, url: urls.get(r.photo_path) ?? null }));
}

export async function addMosaicTile(
  mosaicId: string,
  input: {
    photo_path: string;
    caption?: string | null;
    person_id?: string | null;
  },
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  // clan_id/position do trigger điền; clan_id cần có để qua kiểm tra NOT NULL
  // phía client nên lấy từ bức.
  const m = await getMosaic(mosaicId);
  if (!m) throw new Error("Bức ảnh không tồn tại");
  const { error } = await db.from("clan_mosaic_tiles").insert({
    mosaic_id: mosaicId,
    clan_id: m.clan_id,
    user_id: u.user?.id ?? null,
    photo_path: input.photo_path,
    caption: input.caption ?? null,
    person_id: input.person_id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateMosaicTile(
  id: string,
  patch: Partial<Pick<MosaicTile, "caption" | "status" | "photo_path">>,
): Promise<void> {
  const { error } = await db
    .from("clan_mosaic_tiles")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Xoá mảnh; ảnh trong bucket (không phải link ngoài) cũng được dọn. */
export async function deleteMosaicTile(
  tile: Pick<MosaicTile, "id" | "photo_path">,
): Promise<void> {
  const { error } = await db
    .from("clan_mosaic_tiles")
    .delete()
    .eq("id", tile.id);
  if (error) throw new Error(error.message);
  // Chỉ dọn ảnh do chính tính năng này tải lên. Avatar thành viên và link ngoài
  // là ảnh dùng chung — không được xoá.
  if (tile.photo_path.includes("/mosaic/")) {
    await supabase.storage.from("person-photos").remove([tile.photo_path]);
  }
}

/** Kéo-thả: đưa mảnh tới ô `slot` (ô có mảnh khác → đổi chỗ, chỉ editor). */
export async function moveMosaicTile(
  tileId: string,
  slot: number,
): Promise<void> {
  const { error } = await db.rpc("move_clan_mosaic_tile", {
    p_tile_id: tileId,
    p_slot: slot,
  });
  if (error) throw new Error(error.message);
}

export type MyAvatar = {
  personId: string;
  name: string;
  path: string;
  url: string | null;
};

/** Avatar của người mà thành viên hiện tại đã chọn là mình trên cây (null nếu chưa có). */
export async function getMyAvatar(
  clanId: string,
  userId: string,
): Promise<MyAvatar | null> {
  const { data: mem } = await db
    .from("clan_members")
    .select("self_person_id")
    .eq("clan_id", clanId)
    .eq("user_id", userId)
    .maybeSingle();
  const personId = (mem as { self_person_id: string | null } | null)
    ?.self_person_id;
  if (!personId) return null;
  const { data: p } = await db
    .from("persons")
    .select("id, full_name, photo_path")
    .eq("id", personId)
    .is("deleted_at", null)
    .maybeSingle();
  const person = p as {
    id: string;
    full_name: string;
    photo_path: string | null;
  } | null;
  if (!person?.photo_path) return null;
  return {
    personId: person.id,
    name: person.full_name,
    path: person.photo_path,
    url: await getSignedPhotoUrl(person.photo_path),
  };
}
