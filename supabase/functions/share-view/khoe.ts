/**
 * share-view?khoe=<token>: dữ liệu cho trang thiệp khoe /khoe/:token (docs/plan-thiep-khoe-design.md), trả qua function thay vì
 * để khách đọc thẳng bảng `card_shares`. Chỉ trả thiệp CÒN HẠN; mọi lỗi → 404 trơn (không lộ lý do). Chỉ chứa thứ người tạo đã
 * công khai (tiêu đề, phụ đề, ảnh thiệp, hạn) + tên họ và cờ "họ công khai cây" để trang hiện nút "Xem cây gia phả".
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface KhoePayload {
  clan_id: string;
  clan_name: string | null;
  /** Dòng họ công khai và cho xem cây → trang có nút "Xem cây gia phả". */
  public_tree: boolean;
  card: { title: string; subtitle: string | null; image_path: string; expires_at: string };
}

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

export async function loadKhoe(sb: Sb, token: string | null): Promise<{ status: 200; body: KhoePayload } | { status: 404; body: { error: string } }> {
  const miss = { status: 404 as const, body: { error: "Không tìm thấy thiệp." } };
  if (!token || !TOKEN.test(token)) return miss;
  const { data: row } = await sb
    .from("card_shares")
    .select("title, subtitle, image_path, clan_id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!row) return miss;
  const { data: clan } = await sb.from("clans").select("name, visibility, public_show_tree").eq("id", row.clan_id).maybeSingle();
  return {
    status: 200,
    body: {
      clan_id: row.clan_id,
      clan_name: (clan?.name as string | null) ?? null,
      public_tree: clan?.visibility === "public" && !!clan?.public_show_tree,
      card: { title: row.title, subtitle: row.subtitle ?? null, image_path: row.image_path, expires_at: row.expires_at },
    },
  };
}
