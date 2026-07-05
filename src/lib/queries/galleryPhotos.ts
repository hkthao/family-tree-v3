import { supabase } from "@/lib/supabase";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";

/** Một bức ảnh treo trong phòng trưng bày. */
export type GalleryPhoto = {
  id: string;
  path: string;
  url: string;
  title: string;
  subtitle: string;
};

/** Số ảnh tối đa treo cùng lúc (giữ mượt trên điện thoại). */
export const GALLERY_CAP = 80;

/** URL có phải video không: đuôi file trực tiếp (mp4/webm/…) hoặc link video
 *  phổ biến không có đuôi (Pexels /download/video/, videos.pexels.com…). */
export const isVideoUrl = (u: string | null | undefined) =>
  !!u &&
  (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(u) ||
    /\/download\/video\//i.test(u) ||
    /videos?\.pexels\.com/i.test(u) ||
    /\/video-files\//i.test(u));

const year = (d: string | null) => (d ? d.slice(0, 4) : "");

/**
 * Gộp ảnh dòng họ từ nhiều nguồn để dựng "Phòng ký ức":
 *  - Chân dung thành viên (`persons.photo_path`) — nhãn tên · năm.
 *  - Ảnh mộ phần (`resting_place_photos`) — nhãn theo nơi an nghỉ.
 * (Ảnh Di sản/heritage sẽ bổ sung sau.)
 * Trả về danh sách kèm signed URL (bucket private), giới hạn GALLERY_CAP ảnh.
 */
export async function getGalleryPhotos(
  clanId: string,
): Promise<GalleryPhoto[]> {
  const [personsRes, gravesRes] = await Promise.all([
    supabase
      .from("persons")
      .select("id, full_name, birth_date, death_date, photo_path")
      .eq("clan_id", clanId)
      .not("photo_path", "is", null)
      .order("generation", { ascending: true }),
    supabase
      .from("resting_places")
      .select("id, name, resting_place_photos(path, sort)")
      .eq("clan_id", clanId)
      .is("deleted_at", null),
  ]);

  const items: Omit<GalleryPhoto, "url">[] = [];

  for (const p of personsRes.data ?? []) {
    if (!p.photo_path) continue;
    const years = [year(p.birth_date), year(p.death_date)]
      .filter(Boolean)
      .join(" – ");
    items.push({
      id: `person:${p.id}`,
      path: p.photo_path,
      title: p.full_name,
      subtitle: years,
    });
  }

  for (const g of gravesRes.data ?? []) {
    const photos = (g.resting_place_photos ?? []) as {
      path: string;
      sort: number;
    }[];
    photos.sort((a, b) => a.sort - b.sort);
    photos.forEach((ph, i) => {
      items.push({
        id: `grave:${g.id}:${i}`,
        path: ph.path,
        title: g.name || "Mộ phần",
        subtitle: "Nơi an nghỉ",
      });
    });
  }

  const capped = items.slice(0, GALLERY_CAP);
  const urlMap = await getSignedPhotoUrlMap(capped.map((i) => i.path));

  return capped
    .map((i) => ({ ...i, url: urlMap.get(i.path) ?? "" }))
    .filter((i) => i.url);
}
