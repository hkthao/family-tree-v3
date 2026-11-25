/**
 * Xác định ngữ cảnh truy cập của share-view / og-post: link chia sẻ (token) hoặc dòng họ công khai (không token).
 * Một chỗ duy nhất quyết định link nào còn hiệu lực để hai function không lệch nhau.
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface ShareCtx {
  clan_id: string;
  root_person_id: string | null;
  root_resting_place_id: string | null;
  root_heritage_item_id: string | null;
  expires_at: string;
  is_revoked: boolean;
  scope: string;
  recipient_label?: string | null;
  contrib_paused_at?: string | null;
}

export type AccessResult = { ok: true; link: ShareCtx } | { ok: false; status: number; error: string };

export async function resolveShareAccess(sb: Sb, token: string | null, clanParam: string | null): Promise<AccessResult> {
  if (token) {
    const { data, error } = await sb
      .from("share_links")
      .select("clan_id, root_person_id, root_resting_place_id, root_heritage_item_id, expires_at, is_revoked, scope, recipient_label, contrib_paused_at")
      .eq("token", token)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!data) return { ok: false, status: 404, error: "Link không tồn tại." };
    if (data.is_revoked) return { ok: false, status: 410, error: "Link đã bị thu hồi." };
    if (new Date(data.expires_at) < new Date()) return { ok: false, status: 410, error: "Link đã hết hạn." };
    return { ok: true, link: data as ShareCtx };
  }
  // Xem trước công khai theo clan id — chỉ khi dòng họ công khai + cho xem cây.
  const { data: c } = await sb.from("clans").select("id, visibility, public_show_tree").eq("id", clanParam).maybeSingle();
  if (!c) return { ok: false, status: 404, error: "Dòng họ không tồn tại." };
  if (c.visibility !== "public" || !c.public_show_tree) return { ok: false, status: 403, error: "Dòng họ này không công khai." };
  return {
    ok: true,
    link: {
      clan_id: c.id as string,
      root_person_id: null,
      root_resting_place_id: null,
      root_heritage_item_id: null,
      expires_at: "2999-01-01",
      is_revoked: false,
      scope: "tree_view",
    },
  };
}
