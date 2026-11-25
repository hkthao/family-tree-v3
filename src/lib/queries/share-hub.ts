import { supabase } from "@/lib/supabase";
import {
  extendedExpiry,
  type HubCardRow,
  type HubLinkRow,
  type HubNames,
} from "@/lib/shareHub";

/** Tải dữ liệu Trung tâm chia sẻ (chỉ admin gọi được phần share_links — RLS `share_links_admin_all`). */

const LINK_COLS =
  "id, token, scope, root_person_id, root_resting_place_id, root_heritage_item_id, recipient_label, expires_at, is_revoked, created_at";
const CARD_COLS =
  "id, token, title, subtitle, expires_at, created_at, view_count";
const LIMIT = 500;

export interface HubData {
  links: HubLinkRow[];
  cards: HubCardRow[];
  names: HubNames;
}

export async function loadShareHub(clanId: string): Promise<HubData> {
  const [l, c] = await Promise.all([
    supabase
      .from("share_links")
      .select(LINK_COLS)
      .eq("clan_id", clanId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("card_shares")
      .select(CARD_COLS)
      .eq("clan_id", clanId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);
  if (l.error) throw new Error(l.error.message);
  if (c.error) throw new Error(c.error.message);
  const links = (l.data ?? []) as HubLinkRow[];
  const cards = (c.data ?? []) as HubCardRow[];

  const ids = (
    k: "root_person_id" | "root_resting_place_id" | "root_heritage_item_id",
  ) => [...new Set(links.map((x) => x[k]).filter((v): v is string => !!v))];
  const [pe, pl, he] = await Promise.all([
    ids("root_person_id").length
      ? supabase
          .from("persons")
          .select("id, full_name")
          .in("id", ids("root_person_id"))
      : Promise.resolve({ data: [], error: null }),
    ids("root_resting_place_id").length
      ? supabase
          .from("resting_places")
          .select("id, name")
          .in("id", ids("root_resting_place_id"))
      : Promise.resolve({ data: [], error: null }),
    ids("root_heritage_item_id").length
      ? supabase
          .from("heritage_items")
          .select("id, title")
          .in("id", ids("root_heritage_item_id"))
      : Promise.resolve({ data: [], error: null }),
  ]);
  const map = (rows: unknown[] | null, k: string) =>
    new Map(
      (rows ?? []).map((r) => [
        (r as { id: string }).id,
        String((r as Record<string, unknown>)[k] ?? ""),
      ]),
    );
  return {
    links,
    cards,
    names: {
      persons: map(pe.data, "full_name"),
      places: map(pl.data, "name"),
      heritage: map(he.data, "title"),
    },
  };
}

/** Gia hạn link: thêm `days` ngày tính từ hạn cũ (hoặc từ bây giờ nếu đã hết hạn). Link đã thu hồi không gia hạn. */
export async function extendShareLinkExpiry(
  id: string,
  currentExpiresAt: string,
  days: number,
): Promise<void> {
  const { error } = await supabase
    .from("share_links")
    .update({ expires_at: extendedExpiry(currentExpiresAt, days) })
    .eq("id", id)
    .eq("is_revoked", false);
  if (error) throw new Error(error.message);
}

/** Thiệp khoe tối đa 90 ngày kể từ lúc gia hạn (ràng buộc của bảng). */
export async function extendCardExpiry(
  id: string,
  currentExpiresAt: string,
  days: number,
): Promise<void> {
  const target = new Date(extendedExpiry(currentExpiresAt, days)).getTime();
  const cap = Date.now() + 90 * 86_400_000;
  const { error } = await supabase
    .from("card_shares")
    .update({ expires_at: new Date(Math.min(target, cap)).toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Gỡ thiệp khoe ngay: cho hết hạn bây giờ; cron cleanup-card-shares dọn ảnh + dòng (xoá thẳng sẽ bỏ sót ảnh). */
export async function endCardNow(id: string): Promise<void> {
  const { error } = await supabase
    .from("card_shares")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
