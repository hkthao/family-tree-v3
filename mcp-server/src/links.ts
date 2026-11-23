/**
 * Công cụ cho "Liên kết dòng họ" (bảng person_links): nối một người của họ này với dòng họ khác.
 * Cùng hai lớp phân quyền như resources.ts: gói của token (tool ghi cần `write`) và RLS/RPC của app chạy bằng JWT
 * của CHỦ TOKEN (chỉ quản trị dòng họ mới đề nghị / xác nhận / gỡ được).
 *
 * Token MCP bị khoá vào MỘT dòng họ → mọi truy vấn chỉ thấy liên kết có họ này ở một trong hai phía, và người được
 * gắn phải thuộc chính họ này (khoá ngoại không tự kiểm điều đó).
 */

import { UserError, UUID_RE } from "./fields.ts";
import type { Ctx } from "./ops.ts";

type Args = Record<string, unknown>;

const TYPES = ["same_person", "ancestor_of", "descendant_of", "related"] as const;
const STATUSES = ["pending", "confirmed", "revoked"] as const;
const COLS = "id, link_type, status, clan_a_id, person_a_id, clan_b_id, person_b_id, person_b_name_hint, note, created_at, confirmed_at, revoked_at";
const DENIED = "Không thực hiện được: không tìm thấy liên kết, hoặc chủ token không đủ quyền (cần là quản trị dòng họ).";

const uuid = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(`${name} phải là id (UUID).`);
  return v;
};
const only = (a: Args, keys: string[]) => {
  for (const k of Object.keys(a)) if (!keys.includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ. Cho phép: ${keys.join(", ")}.`);
};
const text = (v: unknown, name: string, max: number): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new UserError(`${name} phải là chuỗi.`);
  const t = v.trim();
  if (t.length > max) throw new UserError(`${name} quá dài (tối đa ${max}).`);
  return t || null;
};

interface LinkRow {
  id: string;
  link_type: string;
  status: string;
  clan_a_id: string;
  person_a_id: string;
  clan_b_id: string | null;
  person_b_id: string | null;
  person_b_name_hint: string | null;
  note: string | null;
  created_at: string;
  confirmed_at: string | null;
  revoked_at: string | null;
}

/** Id người của CHÍNH họ này (chưa xoá mềm). */
async function personInClan(c: Ctx, id: unknown): Promise<{ id: string; full_name: string }> {
  const pid = uuid(id, "person_id");
  const { data, error } = await c.db.from("persons").select("id, full_name").eq("clan_id", c.clanId).eq("id", pid).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError("person_id không thuộc dòng họ này (xem search_person).");
  return data as { id: string; full_name: string };
}

/** Liên kết có họ này ở một trong hai phía. */
async function ourLink(c: Ctx, id: unknown): Promise<LinkRow> {
  const lid = uuid(id, "link_id");
  const { data, error } = await c.db.from("person_links").select(COLS).eq("id", lid).or(`clan_a_id.eq.${c.clanId},clan_b_id.eq.${c.clanId}`).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError("Không tìm thấy liên kết này của dòng họ (xem list_clan_links).");
  return data as unknown as LinkRow;
}

const mine = (c: Ctx, l: LinkRow) => (l.clan_a_id === c.clanId ? { person: l.person_a_id, other: l.clan_b_id, otherPerson: l.person_b_id, direction: "outgoing" } : { person: l.person_b_id, other: l.clan_a_id, otherPerson: l.person_a_id, direction: "incoming" });

function token(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function listClanLinks(c: Ctx, a: Args): Promise<string> {
  only(a, ["status", "limit"]);
  if (a.status !== undefined && !STATUSES.includes(a.status as never)) throw new UserError(`status phải là: ${STATUSES.join(", ")}.`);
  const limit = Math.min(Math.max(Number.isInteger(a.limit) ? (a.limit as number) : 25, 1), 50);
  let q = c.db.from("person_links").select(COLS).or(`clan_a_id.eq.${c.clanId},clan_b_id.eq.${c.clanId}`).order("created_at", { ascending: false }).limit(limit);
  if (a.status) q = q.eq("status", a.status as string);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as LinkRow[];
  if (!rows.length) return "Dòng họ chưa có liên kết nào" + (a.status ? ` ở trạng thái ${a.status}.` : ".");
  const ids = [...new Set(rows.map((r) => mine(c, r).person).filter((x): x is string => !!x))];
  const { data: ps } = ids.length ? await c.db.from("persons").select("id, full_name").eq("clan_id", c.clanId).in("id", ids) : { data: [] };
  const name = new Map((ps ?? []).map((p) => [p.id as string, p.full_name as string]));
  return JSON.stringify(
    rows.map((r) => {
      const m = mine(c, r);
      return {
        id: r.id,
        direction: m.direction,
        type: r.link_type,
        status: r.status,
        our_person: m.person ? { id: m.person, name: name.get(m.person) ?? null } : null,
        other_clan_id: m.other,
        other_person_hint: r.person_b_name_hint,
        note: r.note,
        created_at: r.created_at,
      };
    }),
    null,
    1,
  );
}

export async function getClanLink(c: Ctx, a: Args): Promise<string> {
  only(a, ["link_id"]);
  const l = await ourLink(c, a.link_id);
  const out: Record<string, unknown> = { ...l, direction: mine(c, l).direction };
  if (l.status === "confirmed") {
    const { data, error } = await c.db.rpc("get_link_peek", { p_link_id: l.id });
    if (!error) out.other_side = data;
  }
  if (l.status === "pending" && l.clan_a_id === c.clanId) {
    const { data } = await c.db.from("person_links").select("invite_token").eq("id", l.id).maybeSingle();
    if (data?.invite_token) out.invite_token = data.invite_token;
  }
  return JSON.stringify(out, null, 1);
}

export async function createClanLink(c: Ctx, a: Args): Promise<string> {
  only(a, ["person_id", "link_type", "person_b_name_hint", "note"]);
  const p = await personInClan(c, a.person_id);
  const link_type = a.link_type === undefined ? "same_person" : a.link_type;
  if (!TYPES.includes(link_type as never)) throw new UserError(`link_type phải là: ${TYPES.join(", ")}.`);
  const tok = token();
  const { data, error } = await c.db
    .from("person_links")
    .insert({
      link_type,
      clan_a_id: c.clanId,
      person_a_id: p.id,
      invite_token: tok,
      person_b_name_hint: text(a.person_b_name_hint, "person_b_name_hint", 200),
      note: text(a.note, "note", 1000),
      created_by: c.userId,
    })
    .select("id");
  if (error) throw new UserError(error.message);
  if (!data?.length) throw new UserError("Không tạo được liên kết: chỉ quản trị dòng họ mới đề nghị liên kết.");
  return `Đã tạo đề nghị liên kết (id ${data[0].id}) cho ${p.full_name}. Gửi mã mời này cho quản trị dòng họ bên kia: ${tok}. Liên kết chỉ có hiệu lực khi họ xác nhận.`;
}

export async function createClanLinkFromToken(c: Ctx, a: Args): Promise<string> {
  only(a, ["token", "person_id"]);
  if (typeof a.token !== "string" || a.token.trim().length < 8 || a.token.length > 200) throw new UserError("token không hợp lệ.");
  const p = await personInClan(c, a.person_id);
  const { data, error } = await c.db.rpc("confirm_link_by_token", { p_token: a.token.trim(), p_clan_b: c.clanId, p_person_b: p.id });
  if (error) throw new UserError(error.message);
  return `Đã xác nhận liên kết cho ${p.full_name}${typeof data === "string" ? ` (id ${data})` : ""}.`;
}

export async function setClanLinkStatus(c: Ctx, a: Args): Promise<string> {
  only(a, ["link_id", "status"]);
  if (a.status !== "confirmed") throw new UserError('status chỉ nhận "confirmed" (đồng ý đề nghị đến từ họ khác).');
  const l = await ourLink(c, a.link_id);
  if (l.clan_b_id !== c.clanId || l.status !== "pending") throw new UserError("Chỉ đồng ý được đề nghị liên kết đang chờ mà dòng họ khác gửi tới họ này (direction incoming).");
  const { data, error } = await c.db.from("person_links").update({ status: "confirmed" }).eq("id", l.id).select("status");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã đồng ý liên kết." : DENIED;
}

export async function deleteClanLink(c: Ctx, a: Args): Promise<string> {
  only(a, ["link_id", "confirm"]);
  const l = await ourLink(c, a.link_id);
  if (a.confirm !== true) throw new UserError("Cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu rõ ràng.");
  if (l.status === "pending") {
    // Chỉ bên đề nghị (A) xoá hẳn được đề nghị còn chờ; bên nhận thì từ chối bằng cách gỡ (revoke).
    if (l.clan_a_id === c.clanId) {
      const { data, error } = await c.db.from("person_links").delete().eq("id", l.id).select("id");
      if (error) throw new UserError(error.message);
      return data?.length ? "Đã huỷ đề nghị liên kết." : DENIED;
    }
  }
  if (l.status === "revoked") throw new UserError("Liên kết này đã được gỡ từ trước.");
  const { data, error } = await c.db.from("person_links").update({ status: "revoked" }).eq("id", l.id).select("status");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã gỡ liên kết (giữ trong lịch sử)." : DENIED;
}

export const LINK_OPS: Record<string, (c: Ctx, a: Args) => Promise<string>> = {
  list_clan_links: listClanLinks,
  get_clan_link: getClanLink,
  create_clan_link: createClanLink,
  create_clan_link_from_token: createClanLinkFromToken,
  set_clan_link_status: setClanLinkStatus,
  delete_clan_link: deleteClanLink,
};
