import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface ClanDetail {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  hide_living_for_nonmembers: boolean;
  hide_photos_in_share: boolean;
  /** Người đã mất: hiện thêm ngày giỗ + tuổi thọ (cây + sổ PDF). */
  display_death_details: boolean;
  /** Người sống: hiện đầy đủ ngày-tháng-năm sinh (cây + sổ PDF). */
  display_living_full_dob: boolean;
  /**
   * Offset hiển thị "Đời N" — 0 (mặc định) = Thủy tổ là Đời 1;
   * 1 = Thủy tổ là Đời 0. DB vẫn lưu generation thực (1-based).
   */
  generation_offset: number;
  /** Người xem công khai (đăng nhập, không phải thành viên) được xem phần nào.
   *  Chỉ có hiệu lực khi visibility='public'. */
  public_show_tree: boolean;
  public_show_heritage: boolean;
  public_show_graves: boolean;
  public_show_events: boolean;
  max_persons: number;
  max_users: number;
  data_version: number;
  owner_id: string | null;
  /** Key tính năng phụ đang TẮT cho dòng họ này (opt-out). Rỗng = bật hết. */
  disabled_features: string[];
  /** Caller's role in this clan, derived from clan_members. */
  myRole: "admin" | "editor" | "viewer" | null;
  /**
   * True when the caller has profiles.is_platform_admin = true. Treated as
   * effective admin for every clan in UI gates; the underlying RLS helpers
   * already grant the access, this surfaces it so pages can render the
   * admin-only controls without re-fetching the profile.
   */
  isPlatformAdmin: boolean;
}

/**
 * Fetch one clan + caller's role. Returns null if the caller has no access
 * (RLS hides the row, so the query simply returns empty).
 */
export async function getClanDetail(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<ClanDetail | null> {
  const [
    { data: clan, error: clanErr },
    { data: membership },
    { data: profile },
  ] = await Promise.all([
    client
      .from("clans")
      .select(
        "id, name, description, visibility, hide_living_for_nonmembers, hide_photos_in_share, display_death_details, display_living_full_dob, generation_offset, public_show_tree, public_show_heritage, public_show_graves, public_show_events, max_persons, max_users, data_version, owner_id, disabled_features",
      )
      .eq("id", clanId)
      .maybeSingle(),
    client
      .from("clan_members")
      .select("role")
      .eq("clan_id", clanId)
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (clanErr) throw new Error(clanErr.message);
  if (!clan) return null;

  return {
    ...clan,
    visibility: clan.visibility as ClanDetail["visibility"],
    myRole: (membership?.role as ClanDetail["myRole"]) ?? null,
    isPlatformAdmin: !!profile?.is_platform_admin,
  };
}
