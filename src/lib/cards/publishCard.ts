import { supabase } from "@/lib/supabase";

const BUCKET = "card-shares";

/** Token url-safe 32 ký tự (giống share-links). */
export function makeShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface PublishKhoeInput {
  token: string;
  clanId: string;
  personId?: string | null;
  blob: Blob;
  title: string;
  subtitle?: string | null;
  /** Số ngày sống của link (tối đa 90 = 3 tháng). */
  ttlDays: number;
}

/**
 * Lưu ảnh thiệp "khoe" vào bucket công khai + tạo/cập nhật row
 * card_shares để trang /khoe/:token hiển thị. Upsert theo token nên
 * chia sẻ lại (đổi mẫu/hạn) sẽ ghi đè đúng ảnh đó.
 */
export async function publishKhoeCard(input: PublishKhoeInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Cần đăng nhập để tạo link khoe.");

  const path = `${input.clanId}/${input.token}.png`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, input.blob, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(up.error.message);

  const expiresAt = new Date(
    Date.now() + input.ttlDays * 86_400_000,
  ).toISOString();
  const { error } = await supabase.from("card_shares").upsert(
    {
      token: input.token,
      clan_id: input.clanId,
      person_id: input.personId ?? null,
      created_by: uid,
      image_path: path,
      title: input.title,
      subtitle: input.subtitle ?? null,
      expires_at: expiresAt,
    },
    { onConflict: "token" },
  );
  if (error) throw new Error(error.message);
}

/** URL công khai của ảnh thẻ trong bucket card-shares. */
export function getPublicCardUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
