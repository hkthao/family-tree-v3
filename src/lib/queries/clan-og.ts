import type { ClanOgData } from "@/components/cards/ClanOgImage";
import type { ClanOgStyleId } from "@/lib/cards/clanOgStyles";
import { supabase } from "@/lib/supabase";

const BUCKET = "card-shares";

/** Cắt mô tả (markdown) thành một câu ngắn thuần chữ cho ảnh chia sẻ. */
export function ogTagline(
  description: string | null | undefined,
  max = 140,
): string | null {
  const plain = (description ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

/** Quê gốc ngắn cho ô số liệu: bỏ phần trong ngoặc; dài quá thì lấy địa danh cuối (tỉnh/thành). */
export function shortPlace(
  raw: string | null | undefined,
  max = 22,
): string | null {
  const s = (raw ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;\s]+$/, "");
  if (!s) return null;
  if (s.length <= max) return s;
  const last = s.split(",").pop()?.trim();
  return last && last.length <= max
    ? last
    : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Số liệu cho ảnh chia sẻ: số người, số đời (theo cách đánh số của dòng họ), quê gốc. */
export async function loadClanOgData(clan: {
  id: string;
  name: string;
  description: string | null;
  generation_offset: number;
}): Promise<ClanOgData> {
  const [count, maxGen, book] = await Promise.all([
    supabase
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", clan.id)
      .is("deleted_at", null),
    supabase
      .from("persons")
      .select("generation")
      .eq("clan_id", clan.id)
      .is("deleted_at", null)
      .order("generation", { ascending: false })
      .limit(1),
    supabase
      .from("clan_book_texts")
      .select("origin_place")
      .eq("clan_id", clan.id)
      .maybeSingle(),
  ]);
  const top = (maxGen.data?.[0]?.generation as number | undefined) ?? null;
  return {
    clanName: clan.name,
    tagline: ogTagline(clan.description),
    persons: count.count ?? 0,
    generations: top ? Math.max(1, top - (clan.generation_offset ?? 0)) : null,
    place: shortPlace(book.data?.origin_place as string | null),
  };
}

/** URL công khai của ảnh OG đã lưu. */
export function clanOgPublicUrl(
  path: string,
  updatedAt?: string | null,
): string {
  const base = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return updatedAt ? `${base}?v=${Date.parse(updatedAt) || 0}` : base;
}

/**
 * Lưu ảnh OG dòng họ: tải JPEG lên đường dẫn mới (đổi tên mỗi lần để Facebook không giữ ảnh cũ), ghi vào clans, rồi dọn ảnh cũ.
 */
export async function saveClanOg(args: {
  clanId: string;
  styleId: ClanOgStyleId;
  blob: Blob;
  oldPath: string | null;
}): Promise<string> {
  const path = `${args.clanId}/clan-og-${Date.now()}.jpg`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, args.blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase
    .from("clans")
    .update({
      share_og_path: path,
      share_og_style: args.styleId,
      share_og_updated_at: new Date().toISOString(),
    })
    .eq("id", args.clanId);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  if (args.oldPath) await supabase.storage.from(BUCKET).remove([args.oldPath]);
  return path;
}

/** Bỏ ảnh OG tuỳ chỉnh: link chia sẻ quay về thẻ chung của ứng dụng. */
export async function clearClanOg(args: {
  clanId: string;
  oldPath: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("clans")
    .update({
      share_og_path: null,
      share_og_style: null,
      share_og_updated_at: new Date().toISOString(),
    })
    .eq("id", args.clanId);
  if (error) throw new Error(error.message);
  if (args.oldPath) await supabase.storage.from(BUCKET).remove([args.oldPath]);
}

export async function loadClanOgState(clanId: string): Promise<{
  path: string | null;
  style: string | null;
  updatedAt: string | null;
}> {
  const { data, error } = await supabase
    .from("clans")
    .select("share_og_path, share_og_style, share_og_updated_at")
    .eq("id", clanId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    path: (data?.share_og_path as string | null) ?? null,
    style: (data?.share_og_style as string | null) ?? null,
    updatedAt: (data?.share_og_updated_at as string | null) ?? null,
  };
}
