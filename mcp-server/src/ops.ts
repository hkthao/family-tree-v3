/**
 * Thao tác đọc/ghi CHÍNH của máy chủ MCP: người, quan hệ, chi, sự kiện, thông tin dòng họ, sổ gia phả, ảnh.
 *
 * Mọi hàm nhận `Ctx` mang client của CHỦ TOKEN (JWT ngắn hạn) nên RLS và trigger audit áp dụng như người đó
 * tự thao tác trong app. Quy ước:
 *  - lỗi do đầu vào/quyền → ném `UserError` (hiện cho AI để tự sửa), còn lại là lỗi hệ thống;
 *  - lệnh ghi nào cũng `.select("id")` rồi kiểm số dòng: RLS chặn thì trả 0 dòng chứ KHÔNG báo lỗi;
 *  - mọi truy vấn lọc `clan_id` của token (token bị khoá vào một dòng họ);
 *  - nối quan hệ dùng RPC của app (kiểm vòng lặp, giới tính, cùng dòng họ), không tự ghi bảng `families`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePerson, PERSON_FIELDS, UserError, UUID_RE } from "./fields.ts";
import { exportClanBook } from "./book.tsx";
import { loadAvatar } from "./photo.ts";
import { RESOURCE_OPS } from "./resources.ts";

export interface Ctx {
  db: SupabaseClient;
  clanId: string;
  userId: string;
  /**
   * Client MỚI với JWT mới. JWT của `db` chỉ sống 2 phút; thao tác chạy lâu (dựng sổ PDF) phải lấy client mới
   * trước các bước ghi cuối, nếu không sẽ bị "exp claim timestamp check failed".
   */
  fresh: () => Promise<SupabaseClient>;
}
type Args = Record<string, unknown>;

const DENIED = "Không ghi được: không tìm thấy, hoặc chủ token không đủ quyền với thao tác này.";
const NOT_FOUND = "Không tìm thấy người này trong dòng họ.";
const MAX_LIST = 50;

const uuid = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(`${name} phải là id (UUID) — lấy từ search_person / list_persons.`);
  return v;
};
const yr = (d: unknown) => (typeof d === "string" ? d.slice(0, 4) : "");
const life = (p: Record<string, unknown>) => {
  const b = yr(p.birth_date);
  const d = yr(p.death_date);
  return b || d ? ` (${b || "?"}–${d || (p.is_living ? "nay" : "?")})` : "";
};

async function person(c: Ctx, id: string): Promise<{ id: string; full_name: string; gender: "M" | "F"; birth_family_id: string | null }> {
  const { data, error } = await c.db
    .from("persons")
    .select("id, full_name, gender, birth_family_id")
    .eq("clan_id", c.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError(NOT_FOUND);
  return data as never;
}

async function assertBranch(c: Ctx, id: unknown): Promise<void> {
  if (id === null || id === undefined) return;
  const { data } = await c.db.from("branches").select("id").eq("clan_id", c.clanId).eq("id", id as string).is("deleted_at", null).maybeSingle();
  if (!data) throw new UserError("branch_id không thuộc dòng họ này (xem list_branches).");
}

/** Chạy RPC của app; lỗi nghiệp vụ (vòng lặp, khác giới…) trả nguyên văn cho AI. */
async function rpc(c: Ctx, fn: string, params: Args): Promise<string> {
  const { data, error } = await c.db.rpc(fn, params);
  if (error) throw new UserError(error.message);
  return String(data ?? "");
}

// ─── NGƯỜI ──────────────────────────────────────────────────────────────

export async function listPersons(c: Ctx, a: Args): Promise<string> {
  const limit = Math.min(Math.max(Number.isInteger(a.limit) ? (a.limit as number) : 25, 1), MAX_LIST);
  const offset = Math.max(Number.isInteger(a.offset) ? (a.offset as number) : 0, 0);
  let q = c.db
    .from("persons")
    .select("id, full_name, gender, is_living, generation, birth_date, death_date, branch_id, birth_order", { count: "exact" })
    .eq("clan_id", c.clanId)
    .is("deleted_at", null);
  if (typeof a.q === "string" && a.q.trim()) {
    const s = a.q.trim().replace(/[%_,()]/g, " ");
    q = q.or(`full_name.ilike.%${s}%,full_name_unaccent.ilike.%${s}%`);
  }
  if (a.branch_id !== undefined) q = q.eq("branch_id", uuid(a.branch_id, "branch_id"));
  if (Number.isInteger(a.generation)) q = q.eq("generation", a.generation as number);
  if (a.gender === "M" || a.gender === "F") q = q.eq("gender", a.gender);
  if (typeof a.is_living === "boolean") q = q.eq("is_living", a.is_living);
  const { data, count, error } = await q
    .order("generation", { ascending: true, nullsFirst: false })
    .order("birth_order", { ascending: true, nullsFirst: false })
    .order("birth_date", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  if (!data?.length) return `Không có ai khớp (tổng 0).`;
  const rows = data.map((p) => `${p.id} · ${p.full_name}${life(p)} · ${p.gender === "M" ? "nam" : "nữ"}${p.generation ? ` · đời ${p.generation}` : ""}${p.birth_order ? ` · con thứ ${p.birth_order}` : ""}`);
  const more = (count ?? 0) > offset + data.length ? `\n… còn ${(count ?? 0) - offset - data.length} người nữa (dùng offset=${offset + data.length}).` : "";
  return `Tổng ${count ?? data.length} người, hiện ${offset + 1}–${offset + data.length}:\n${rows.join("\n")}${more}`;
}

/** Nối `child` vào gia đình của `parent` (gia đình đầu tiên, hoặc gia đình với `otherParent`); chưa có thì tạo. */
async function attachChild(c: Ctx, childId: string, parentId: string, otherParentId?: string): Promise<void> {
  const parent = await person(c, parentId);
  let famId: string | null = null;
  if (otherParentId) {
    await person(c, otherParentId);
    const { data: fams } = await c.db
      .from("families")
      .select("id, husband_id, wife_id")
      .eq("clan_id", c.clanId)
      .is("deleted_at", null)
      .or(`husband_id.eq.${parentId},wife_id.eq.${parentId}`);
    famId = (fams ?? []).find((f) => f.husband_id === otherParentId || f.wife_id === otherParentId)?.id ?? null;
    if (!famId) famId = await rpc(c, "assign_existing_spouse", { p_person_id: parentId, p_spouse_id: otherParentId });
  } else {
    const { data: fam } = await c.db
      .from("families")
      .select("id")
      .eq("clan_id", c.clanId)
      .is("deleted_at", null)
      .or(`husband_id.eq.${parentId},wife_id.eq.${parentId}`)
      .order("spouse_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    famId = fam?.id ?? null;
  }
  if (famId) await rpc(c, "assign_person_to_family", { p_person_id: childId, p_family_id: famId });
  else await rpc(c, "assign_existing_parent", { p_person_id: childId, p_parent_id: parent.id });
}

export async function createPerson(c: Ctx, a: Args): Promise<string> {
  const { relation_as, relation_of_person_id, other_parent_id, ...fields } = a;
  const payload = normalizePerson(fields, { requireNameAndGender: true });
  await assertBranch(c, payload.branch_id);
  let relOf: string | null = null;
  if (relation_as !== undefined || relation_of_person_id !== undefined) {
    if (relation_as !== "child" && relation_as !== "spouse" && relation_as !== "parent") throw new UserError("relation_as phải là child, spouse hoặc parent.");
    relOf = uuid(relation_of_person_id, "relation_of_person_id");
    const other = await person(c, relOf);
    if (relation_as === "spouse" && other.gender === payload.gender) throw new UserError("Hai người cùng giới tính — app chưa hỗ trợ ghép vợ/chồng cùng giới.");
  }
  const { data, error } = await c.db.from("persons").insert({ ...payload, clan_id: c.clanId }).select("id").single();
  if (error) throw new Error(error.message);
  const id = data.id as string;
  if (relOf) {
    try {
      if (relation_as === "child") await attachChild(c, id, relOf, other_parent_id === undefined ? undefined : uuid(other_parent_id, "other_parent_id"));
      else if (relation_as === "spouse") await rpc(c, "assign_existing_spouse", { p_person_id: id, p_spouse_id: relOf });
      else await rpc(c, "assign_existing_parent", { p_person_id: relOf, p_parent_id: id });
    } catch (e) {
      await c.db.from("persons").delete().eq("id", id).is("deleted_at", null); // xoá mềm, không để người mồ côi
      throw e;
    }
  }
  return `Đã thêm ${payload.full_name} (id ${id})${relOf ? ` và nối quan hệ ${relation_as}` : ""}.`;
}

export async function updatePerson(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.person_id, "person_id");
  const changes = normalizePerson(a.changes);
  await assertBranch(c, changes.branch_id);
  const { data, error } = await c.db.from("persons").update(changes).eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã cập nhật: ${Object.keys(changes).filter((k) => k in PERSON_FIELDS).join(", ")}.` : DENIED;
}

export async function appendNote(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.person_id, "person_id");
  const note = typeof a.note === "string" ? a.note.trim() : "";
  if (!note || note.length > 4000) throw new UserError("note trống hoặc quá dài (tối đa 4000).");
  const { data: p } = await c.db.from("persons").select("bio").eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!p) throw new UserError(NOT_FOUND);
  return updatePerson(c, { person_id: id, changes: { bio: p.bio ? `${p.bio}\n\n${note}` : note } });
}

export async function deletePerson(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.person_id, "person_id");
  if (a.confirm !== true) throw new UserError("Cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu xoá rõ ràng.");
  const { data: before } = await c.db.from("persons").select("deleted_at").eq("clan_id", c.clanId).eq("id", id).maybeSingle();
  if (!before) throw new UserError(NOT_FOUND);
  if (before.deleted_at) return "Người này đã được xoá trước đó.";
  // BẮT BUỘC lọc deleted_at is null: trigger xoá mềm chỉ chặn khi dòng chưa bị xoá; DELETE lần hai = XOÁ CỨNG.
  const { error } = await c.db.from("persons").delete().eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null);
  if (error) throw new UserError(error.message);
  // Xoá mềm = trigger huỷ DELETE rồi UPDATE deleted_at nên RETURNING rỗng: đọc lại trạng thái.
  const { data: after } = await c.db.from("persons").select("deleted_at").eq("clan_id", c.clanId).eq("id", id).maybeSingle();
  return after?.deleted_at ? "Đã xoá (xoá mềm — khôi phục bằng restore_person hoặc từ nhật ký trong app)." : DENIED;
}

export async function restorePerson(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.person_id, "person_id");
  const { data, error } = await c.db.from("persons").update({ deleted_at: null }).eq("clan_id", c.clanId).eq("id", id).not("deleted_at", "is", null).select("id, full_name");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã khôi phục ${data[0].full_name}. Quan hệ gia đình cũ (nếu còn) tự khớp lại; kiểm tra bằng get_relatives.` : "Không có người đã xoá nào khớp id này, hoặc chủ token không đủ quyền.";
}

// ─── QUAN HỆ ────────────────────────────────────────────────────────────

export async function linkRelation(c: Ctx, a: Args): Promise<string> {
  const pid = uuid(a.person_id, "person_id");
  const oid = uuid(a.other_person_id, "other_person_id");
  if (pid === oid) throw new UserError("Hai người phải khác nhau.");
  const [p, o] = [await person(c, pid), await person(c, oid)];
  switch (a.relation) {
    case "parent": // other là cha/mẹ của person
      await rpc(c, "assign_existing_parent", { p_person_id: pid, p_parent_id: oid });
      return `Đã đặt ${o.full_name} là ${o.gender === "M" ? "cha" : "mẹ"} của ${p.full_name}.`;
    case "child": // other là con của person
      await attachChild(c, oid, pid, a.other_parent_id === undefined ? undefined : uuid(a.other_parent_id, "other_parent_id"));
      return `Đã đặt ${o.full_name} là con của ${p.full_name}.`;
    case "spouse":
      await rpc(c, "assign_existing_spouse", { p_person_id: pid, p_spouse_id: oid });
      return `Đã ghép ${p.full_name} và ${o.full_name} thành vợ chồng.`;
    default:
      throw new UserError("relation phải là parent, child hoặc spouse.");
  }
}

export async function unlinkRelation(c: Ctx, a: Args): Promise<string> {
  const pid = uuid(a.person_id, "person_id");
  const oid = uuid(a.other_person_id, "other_person_id");
  const [p, o] = [await person(c, pid), await person(c, oid)];
  const removeParent = async (childId: string, parentId: string) => {
    const { data: me } = await c.db.from("persons").select("birth_family_id").eq("clan_id", c.clanId).eq("id", childId).maybeSingle();
    const fid = me?.birth_family_id as string | null | undefined;
    if (!fid) throw new UserError("Người này chưa có cha mẹ nào để gỡ.");
    const { data: fam } = await c.db.from("families").select("husband_id, wife_id").eq("clan_id", c.clanId).eq("id", fid).maybeSingle();
    if (!fam || (fam.husband_id !== parentId && fam.wife_id !== parentId)) throw new UserError("Hai người này không có quan hệ cha/mẹ - con.");
    const husband = fam.husband_id === parentId ? null : fam.husband_id;
    const wife = fam.wife_id === parentId ? null : fam.wife_id;
    const { data: upd, error } = await c.db.from("families").update({ husband_id: husband, wife_id: wife }).eq("id", fid).select("id");
    if (error) throw new UserError(error.message);
    if (!upd?.length) throw new UserError(DENIED);
    if (husband === null && wife === null) {
      await c.db.from("persons").update({ birth_family_id: null }).eq("id", childId);
      const { count } = await c.db.from("persons").select("id", { count: "exact", head: true }).eq("birth_family_id", fid).is("deleted_at", null);
      if ((count ?? 0) === 0) await c.db.from("families").delete().eq("id", fid);
    }
  };
  switch (a.relation) {
    case "parent":
      await removeParent(pid, oid);
      return `Đã gỡ ${o.full_name} khỏi vai trò cha/mẹ của ${p.full_name} (cả hai vẫn còn trong dòng họ).`;
    case "child":
      await removeParent(oid, pid);
      return `Đã gỡ ${o.full_name} khỏi vai trò con của ${p.full_name} (cả hai vẫn còn trong dòng họ).`;
    case "spouse": {
      const { data: fams } = await c.db
        .from("families")
        .select("id, husband_id, wife_id")
        .eq("clan_id", c.clanId)
        .is("deleted_at", null)
        .or(`husband_id.eq.${pid},wife_id.eq.${pid}`);
      const fam = (fams ?? []).find((f) => f.husband_id === oid || f.wife_id === oid);
      if (!fam) throw new UserError("Hai người này không phải vợ chồng.");
      const { count } = await c.db.from("persons").select("id", { count: "exact", head: true }).eq("birth_family_id", fam.id).is("deleted_at", null);
      if ((count ?? 0) === 0) {
        const { error } = await c.db.from("families").delete().eq("id", fam.id);
        if (error) throw new UserError(error.message);
        return `Đã gỡ quan hệ vợ chồng giữa ${p.full_name} và ${o.full_name}.`;
      }
      // Đã có con: giữ gia đình để con vẫn thuộc về người còn lại (khớp hành vi trong app).
      const patch = fam.husband_id === oid ? { husband_id: null } : { wife_id: null };
      const { error } = await c.db.from("families").update(patch).eq("id", fam.id);
      if (error) throw new UserError(error.message);
      return `Đã gỡ ${o.full_name} khỏi cuộc hôn nhân (gia đình được giữ lại vì đã có con).`;
    }
    default:
      throw new UserError("relation phải là parent, child hoặc spouse.");
  }
}

export async function setSpouseOrder(c: Ctx, a: Args): Promise<string> {
  const pid = uuid(a.person_id, "person_id");
  if (!Array.isArray(a.spouse_ids) || a.spouse_ids.length === 0) throw new UserError("spouse_ids phải là danh sách id vợ/chồng theo thứ tự (vợ/chồng cả trước).");
  const ids = a.spouse_ids.map((x) => uuid(x, "spouse_ids[]"));
  const { data: fams } = await c.db.from("families").select("id, husband_id, wife_id").eq("clan_id", c.clanId).is("deleted_at", null).or(`husband_id.eq.${pid},wife_id.eq.${pid}`);
  const famIds = ids.map((sid) => (fams ?? []).find((f) => f.husband_id === sid || f.wife_id === sid)?.id as string | undefined);
  if (famIds.some((f) => !f)) throw new UserError("Có người trong spouse_ids không phải vợ/chồng của person_id.");
  const results = await Promise.all(famIds.map((fid, i) => c.db.from("families").update({ spouse_order: i + 1 }).eq("id", fid!).select("id")));
  if (results.some((r) => r.error || !r.data?.length)) throw new UserError(DENIED);
  return `Đã đặt thứ tự ${ids.length} vợ/chồng.`;
}

// ─── ẢNH ĐẠI DIỆN ───────────────────────────────────────────────────────

export async function setPersonPhoto(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.person_id, "person_id");
  const p = await person(c, id);
  const jpeg = await loadAvatar(a);
  const path = `${c.clanId}/${id}.jpg`; // cùng quy ước app: một file/người, ghi đè
  const { error } = await c.db.storage.from("person-photos").upload(path, jpeg, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw new UserError(`Không tải ảnh lên được: ${error.message}`);
  const { data, error: ue } = await c.db.from("persons").update({ photo_path: path }).eq("clan_id", c.clanId).eq("id", id).select("id");
  if (ue) throw new UserError(ue.message);
  if (!data?.length) throw new UserError(DENIED);
  return `Đã đặt ảnh đại diện cho ${p.full_name} (${Math.round(jpeg.length / 1024)} KB).`;
}

export async function removePersonPhoto(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.person_id, "person_id");
  const { data: p } = await c.db.from("persons").select("full_name, photo_path").eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!p) throw new UserError(NOT_FOUND);
  if (!p.photo_path) return `${p.full_name} chưa có ảnh đại diện.`;
  const { data, error } = await c.db.from("persons").update({ photo_path: null }).eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  if (!data?.length) throw new UserError(DENIED);
  // Chỉ xoá file trong thư mục của chính dòng họ này.
  if ((p.photo_path as string).startsWith(`${c.clanId}/`)) await c.db.storage.from("person-photos").remove([p.photo_path as string]);
  return `Đã xoá ảnh đại diện của ${p.full_name}.`;
}

// ─── CHI / NHÁNH ────────────────────────────────────────────────────────

const str = (v: unknown, name: string, max: number, nullable = true): string | null => {
  if (v === null) {
    if (!nullable) throw new UserError(`${name} không được để trống.`);
    return null;
  }
  if (typeof v !== "string") throw new UserError(`${name} phải là chuỗi.`);
  const t = v.trim();
  if (t.length > max) throw new UserError(`${name} quá dài (tối đa ${max}).`);
  if (!t && !nullable) throw new UserError(`${name} không được để trống.`);
  return t || null;
};

export async function listBranches(c: Ctx): Promise<string> {
  const { data, error } = await c.db.from("branches").select("id, name, head_person_id, ancestral_house, notes").eq("clan_id", c.clanId).is("deleted_at", null).order("name");
  if (error) throw new Error(error.message);
  if (!data?.length) return "Dòng họ chưa có chi/nhánh nào.";
  return data.map((b) => `${b.id} · ${b.name}${b.ancestral_house ? ` · nhà thờ: ${b.ancestral_house}` : ""}${b.head_person_id ? ` · trưởng chi: ${b.head_person_id}` : ""}${b.notes ? ` · ${String(b.notes).slice(0, 80)}` : ""}`).join("\n");
}

async function branchPatch(c: Ctx, a: Args, requireName: boolean): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (a.name !== undefined) out.name = str(a.name, "name", 200, false);
  else if (requireName) throw new UserError("name là bắt buộc.");
  if (a.ancestral_house !== undefined) out.ancestral_house = str(a.ancestral_house, "ancestral_house", 300);
  if (a.notes !== undefined) out.notes = str(a.notes, "notes", 5000);
  if (a.head_person_id !== undefined) {
    out.head_person_id = a.head_person_id === null ? null : (await person(c, uuid(a.head_person_id, "head_person_id"))).id;
  }
  if (Object.keys(out).length === 0) throw new UserError("Không có trường nào để ghi.");
  return out;
}

export async function createBranch(c: Ctx, a: Args): Promise<string> {
  const patch = await branchPatch(c, a, true);
  const { data, error } = await c.db.from("branches").insert({ ...patch, clan_id: c.clanId }).select("id").single();
  if (error) throw new UserError(error.message);
  return `Đã tạo chi "${patch.name}" (id ${data.id}). Gán người vào chi bằng update_person { branch_id }.`;
}

export async function updateBranch(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.branch_id, "branch_id");
  const { branch_id: _b, ...rest } = a;
  const patch = await branchPatch(c, rest, false);
  const { data, error } = await c.db.from("branches").update(patch).eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã cập nhật chi." : DENIED;
}

export async function deleteBranch(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.branch_id, "branch_id");
  if (a.confirm !== true) throw new UserError("Cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu xoá rõ ràng.");
  const { data: b } = await c.db.from("branches").select("deleted_at").eq("clan_id", c.clanId).eq("id", id).maybeSingle();
  if (!b) throw new UserError("Không tìm thấy chi này.");
  if (b.deleted_at) return "Chi này đã được xoá trước đó.";
  const { error } = await c.db.from("branches").delete().eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null);
  if (error) throw new UserError(error.message);
  const { data: after } = await c.db.from("branches").select("deleted_at").eq("clan_id", c.clanId).eq("id", id).maybeSingle();
  return after?.deleted_at ? "Đã xoá chi (xoá mềm). Người thuộc chi này hiển thị như chưa có chi." : DENIED;
}

// ─── SỰ KIỆN ────────────────────────────────────────────────────────────

const EVENT_TYPES = ["custom", "reunion", "memorial", "tomb_visit"];

export async function listEvents(c: Ctx): Promise<string> {
  const { data, error } = await c.db
    .from("events")
    .select("id, title, event_type, date_solar, lunar_year, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id, notes")
    .eq("clan_id", c.clanId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Dòng họ chưa có sự kiện riêng nào.";
  return data
    .map((e) => {
      const when = e.date_solar ? `dương ${e.date_solar}` : `âm ${e.lunar_day ?? "?"}/${e.lunar_month}${e.lunar_is_leap ? " (nhuận)" : ""}${e.lunar_year ? `/${e.lunar_year}` : ""}`;
      return `${e.id} · ${e.title} · ${e.event_type} · ${when}${e.is_yearly ? " · hằng năm" : ""}${e.related_person_id ? ` · người liên quan: ${e.related_person_id}` : ""}`;
    })
    .join("\n");
}

async function eventPatch(c: Ctx, a: Args, creating: boolean): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (a.title !== undefined) out.title = str(a.title, "title", 200, false);
  else if (creating) throw new UserError("title là bắt buộc.");
  if (a.event_type !== undefined) {
    if (!EVENT_TYPES.includes(a.event_type as string)) throw new UserError(`event_type phải là: ${EVENT_TYPES.join(", ")}.`);
    out.event_type = a.event_type;
  }
  if (a.date_solar !== undefined) {
    if (a.date_solar === null) out.date_solar = null;
    else {
      const m = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date_solar)) && !Number.isNaN(Date.parse(String(a.date_solar)));
      if (!m) throw new UserError("date_solar phải dạng YYYY-MM-DD.");
      out.date_solar = a.date_solar;
    }
  }
  const lun = (k: string, lo: number, hi: number) => {
    if (a[k] === undefined) return;
    if (a[k] !== null && (!Number.isInteger(a[k]) || (a[k] as number) < lo || (a[k] as number) > hi)) throw new UserError(`${k} phải là số nguyên ${lo}–${hi}.`);
    out[k] = a[k];
  };
  lun("lunar_year", 1, 2100);
  lun("lunar_month", 1, 12);
  lun("lunar_day", 1, 30);
  if (a.lunar_is_leap !== undefined) {
    if (typeof a.lunar_is_leap !== "boolean") throw new UserError("lunar_is_leap phải là true/false.");
    out.lunar_is_leap = a.lunar_is_leap;
  }
  if (a.is_yearly !== undefined) {
    if (typeof a.is_yearly !== "boolean") throw new UserError("is_yearly phải là true/false.");
    out.is_yearly = a.is_yearly;
  }
  if (a.notes !== undefined) out.notes = str(a.notes, "notes", 5000);
  if (a.related_person_id !== undefined) out.related_person_id = a.related_person_id === null ? null : (await person(c, uuid(a.related_person_id, "related_person_id"))).id;
  if (creating && (out.date_solar == null) === (out.lunar_month == null)) throw new UserError("Truyền ĐÚNG MỘT trong date_solar (dương lịch) hoặc lunar_month (+ lunar_day) cho sự kiện.");
  if (Object.keys(out).length === 0) throw new UserError("Không có trường nào để ghi.");
  return out;
}

export async function createEvent(c: Ctx, a: Args): Promise<string> {
  const patch = await eventPatch(c, a, true);
  const { data, error } = await c.db.from("events").insert({ is_yearly: true, event_type: "custom", ...patch, clan_id: c.clanId }).select("id").single();
  if (error) throw new UserError(error.message);
  return `Đã tạo sự kiện "${patch.title}" (id ${data.id}).`;
}

export async function updateEvent(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.event_id, "event_id");
  const { event_id: _e, ...rest } = a;
  const patch = await eventPatch(c, rest, false);
  const { data, error } = await c.db.from("events").update(patch).eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã cập nhật sự kiện." : DENIED;
}

export async function deleteEvent(c: Ctx, a: Args): Promise<string> {
  const id = uuid(a.event_id, "event_id");
  if (a.confirm !== true) throw new UserError("Cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu xoá rõ ràng.");
  const { data, error } = await c.db.from("events").delete().eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã xoá sự kiện." : DENIED;
}

// ─── THÔNG TIN DÒNG HỌ & SỔ GIA PHẢ ─────────────────────────────────────

export async function getClanInfo(c: Ctx): Promise<string> {
  const { data, error } = await c.db
    .from("clans")
    .select("id, name, description, visibility, person_count, generation_offset, created_at, updated_at, display_death_details, display_living_full_dob, hide_living_for_nonmembers")
    .eq("id", c.clanId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError("Không đọc được thông tin dòng họ.");
  return JSON.stringify(data, null, 2);
}

/**
 * Chỉ tên, mô tả, offset đời. CỐ Ý không cho đổi chế độ hiển thị (public/private, public_show_*), giới hạn,
 * chủ sở hữu hay tính năng bật tắt: đó là quyết định về quyền riêng tư/vận hành, để người làm trong app.
 */
export async function updateClanInfo(c: Ctx, a: Args): Promise<string> {
  const out: Record<string, unknown> = {};
  const allowed = ["name", "description", "generation_offset"];
  for (const k of Object.keys(a)) if (!allowed.includes(k)) throw new UserError(`Trường "${k}" không được phép. Cho phép: ${allowed.join(", ")}.`);
  if (a.name !== undefined) out.name = str(a.name, "name", 200, false);
  if (a.description !== undefined) out.description = str(a.description, "description", 5000);
  if (a.generation_offset !== undefined) {
    if (!Number.isInteger(a.generation_offset) || (a.generation_offset as number) < 0 || (a.generation_offset as number) > 3) throw new UserError("generation_offset phải là số nguyên 0–3.");
    out.generation_offset = a.generation_offset;
  }
  if (Object.keys(out).length === 0) throw new UserError("Không có trường nào để ghi.");
  const { data, error } = await c.db.from("clans").update(out).eq("id", c.clanId).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã cập nhật thông tin dòng họ: ${Object.keys(out).join(", ")}.` : "Không ghi được: chỉ admin dòng họ mới sửa được thông tin dòng họ.";
}

const BOOK_FIELDS: Record<string, number> = {
  place_line: 300, origin_place: 300, ancestral_hall: 300, ancestor_anniversary: 300, chief_name: 200,
  compilers: 500, compiled_year: 50, contact: 300, preface: 50000, phaky: 50000, ngoai_pha: 50000, phu_khao: 50000,
};

export async function getBookTexts(c: Ctx): Promise<string> {
  const { data, error } = await c.db.from("clan_book_texts").select(Object.keys(BOOK_FIELDS).join(", ")).eq("clan_id", c.clanId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "Dòng họ chưa soạn phần nào của sổ gia phả.";
  const filled = Object.fromEntries(Object.entries(data as unknown as Record<string, unknown>).filter(([, v]) => v !== null && v !== ""));
  return Object.keys(filled).length ? JSON.stringify(filled, null, 2) : "Dòng họ chưa soạn phần nào của sổ gia phả.";
}

export async function updateBookTexts(c: Ctx, a: Args): Promise<string> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(a)) {
    const max = BOOK_FIELDS[k];
    if (!max) throw new UserError(`Trường "${k}" không được phép. Cho phép: ${Object.keys(BOOK_FIELDS).join(", ")}.`);
    out[k] = str(v, k, max);
  }
  if (Object.keys(out).length === 0) throw new UserError("Không có trường nào để ghi.");
  const { data, error } = await c.db.from("clan_book_texts").upsert({ clan_id: c.clanId, ...out }, { onConflict: "clan_id" }).select("clan_id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã cập nhật sổ gia phả: ${Object.keys(out).join(", ")}.` : DENIED;
}


// ─── XEM CÂY GIA PHẢ ────────────────────────────────────────────────────

/**
 * Cây dạng chữ có thụt lề, để AI "đọc" gia phả: hậu duệ (kèm vợ/chồng) hoặc tổ tiên của một người.
 * Nạp người + gia đình của cả dòng họ một lần (≤ vài nghìn người) rồi duyệt trong bộ nhớ; trần 300 dòng.
 */
export async function getTree(c: Ctx, a: Args): Promise<string> {
  const rootId = uuid(a.person_id, "person_id");
  const dir = a.direction === "ancestors" ? "ancestors" : "descendants";
  const depth = Math.min(Math.max(Number.isInteger(a.depth) ? (a.depth as number) : 3, 1), 8);
  const [pr, fr] = await Promise.all([
    c.db.from("persons").select("id, full_name, gender, is_living, birth_date, death_date, birth_order, birth_family_id").eq("clan_id", c.clanId).is("deleted_at", null).limit(10000),
    c.db.from("families").select("id, husband_id, wife_id, spouse_order, created_at").eq("clan_id", c.clanId).is("deleted_at", null).limit(10000),
  ]);
  if (pr.error) throw new Error(pr.error.message);
  type P = { id: string; full_name: string; gender: string; is_living: boolean; birth_date: string | null; death_date: string | null; birth_order: number | null; birth_family_id: string | null };
  type F = { id: string; husband_id: string | null; wife_id: string | null; spouse_order: number | null; created_at: string };
  const people = new Map((pr.data as P[]).map((p) => [p.id, p]));
  const fams = (fr.data ?? []) as F[];
  const root = people.get(rootId);
  if (!root) throw new UserError(NOT_FOUND);
  const label = (p: P) => `${p.full_name}${life(p as never)} [${p.id.slice(0, 8)}]`;
  const lines: string[] = [];
  const CAP = 300;
  const push = (indent: number, text: string) => {
    if (lines.length < CAP) lines.push(`${"  ".repeat(indent)}${text}`);
  };
  const seen = new Set<string>();
  const down = (p: P, indent: number, level: number) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    push(indent, `${p.gender === "M" ? "♂" : "♀"} ${label(p)}${p.birth_order ? ` · con thứ ${p.birth_order}` : ""}`);
    if (level >= depth) return;
    const own = fams.filter((f) => f.husband_id === p.id || f.wife_id === p.id).sort((x, y) => (x.spouse_order ?? 99) - (y.spouse_order ?? 99) || x.created_at.localeCompare(y.created_at));
    for (const f of own) {
      const sp = people.get((f.husband_id === p.id ? f.wife_id : f.husband_id) ?? "");
      if (sp) push(indent + 1, `⚭ ${label(sp)}`);
      const kids = [...people.values()].filter((k) => k.birth_family_id === f.id).sort((x, y) => (x.birth_order ?? 99) - (y.birth_order ?? 99) || String(x.birth_date ?? "").localeCompare(String(y.birth_date ?? "")));
      for (const k of kids) down(k, indent + 2, level + 1);
    }
  };
  const up = (p: P, indent: number, level: number) => {
    push(indent, `${p.gender === "M" ? "♂" : "♀"} ${label(p)}`);
    if (level >= depth || !p.birth_family_id) return;
    const f = fams.find((x) => x.id === p.birth_family_id);
    if (!f) return;
    for (const pid of [f.husband_id, f.wife_id]) {
      const par = pid ? people.get(pid) : undefined;
      if (par) up(par, indent + 1, level + 1);
    }
  };
  if (dir === "descendants") down(root, 0, 1);
  else up(root, 0, 1);
  const cut = lines.length >= CAP ? `\n… cắt ở ${CAP} dòng — giảm depth hoặc chọn người gần gốc hơn.` : "";
  return `${dir === "descendants" ? "Hậu duệ" : "Tổ tiên"} của ${root.full_name} (tối đa ${depth} đời, id rút gọn 8 ký tự — dùng search_person/get_person để lấy id đầy đủ):\n${lines.join("\n")}${cut}`;
}

/** Tên tool → hàm. Handler tra bảng này trước khi rơi về bộ tool tra cứu cũ. */

/**
 * Đóng góp cộng đồng (đã duyệt, người kể cho phép dùng lại) — nguồn cho AI soạn tiểu sử / sửa dữ kiện.
 * AI chỉ ĐỀ XUẤT (propose_* + source_memory_ids); admin duyệt thì đóng góp nguồn tự đánh dấu đã dùng.
 */
async function listMemories(c: Ctx, a: Args): Promise<string> {
  const limit = Math.min(Math.max(Number(a.limit) || 20, 1), MAX_LIST);
  let q = c.db
    .from("person_memories")
    .select(
      "id, person_id, kind, body, external_url, year_approx, place, source, author_name, author_relation, applied_to, created_at, author:profiles!person_memories_author_user_id_fkey(display_name), person:persons(full_name), question:family_questions!person_memories_question_fk(question)",
    )
    .eq("clan_id", c.clanId)
    .eq("status", "visible")
    .eq("allow_ai_reuse", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (a.person_id !== undefined) q = q.eq("person_id", uuid(a.person_id, "person_id"));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // deno-lint-ignore no-explicit-any
  let rows = (data ?? []) as any[];
  if (a.not_applied === true) rows = rows.filter((r) => !Array.isArray(r.applied_to) || r.applied_to.length === 0);
  if (!rows.length) return "Chưa có đóng góp nào phù hợp (đã duyệt, cho phép dùng lại).";
  const kind = (k: string) => (k === "photo" ? "ảnh" : k === "audio" ? "ghi âm" : "câu chuyện");
  return `${rows.length} đóng góp:\n${rows
    .map((r) => {
      const who = [r.author?.display_name ?? r.author_name ?? "Người thân", r.author_relation].filter(Boolean).join(", ");
      const meta = [
        r.year_approx ? `khoảng ${r.year_approx}` : null,
        r.place,
        r.source ? `nguồn: ${r.source}` : null,
        Array.isArray(r.applied_to) && r.applied_to.length ? "ĐÃ đưa vào gia phả" : "chưa đưa vào gia phả",
      ]
        .filter(Boolean)
        .join(" · ");
      const head = `- [${r.id}] ${kind(r.kind)} về ${r.person?.full_name ?? "(chuyện chung của họ)"}${r.person_id ? ` (person_id ${r.person_id})` : ""} — kể bởi ${who}; ${meta}`;
      const q = r.question?.question ? `\n  Câu hỏi: ${r.question.question}` : "";
      const body = r.body ? `\n  ${String(r.body).slice(0, 1500)}` : r.external_url ? `\n  (link: ${r.external_url})` : "";
      return head + q + body;
    })
    .join("\n")}`;
}

export const OPS: Record<string, (c: Ctx, a: Args) => Promise<string>> = {
  list_memories: listMemories,
  list_persons: listPersons,
  get_tree: getTree,
  create_person: createPerson,
  update_person: updatePerson,
  append_person_note: appendNote,
  delete_person: deletePerson,
  restore_person: restorePerson,
  link_relation: linkRelation,
  unlink_relation: unlinkRelation,
  set_spouse_order: setSpouseOrder,
  set_person_photo: setPersonPhoto,
  remove_person_photo: removePersonPhoto,
  list_branches: (c) => listBranches(c),
  create_branch: createBranch,
  update_branch: updateBranch,
  delete_branch: deleteBranch,
  list_events: (c) => listEvents(c),
  create_event: createEvent,
  update_event: updateEvent,
  delete_event: deleteEvent,
  get_clan_info: (c) => getClanInfo(c),
  update_clan_info: updateClanInfo,
  get_book_texts: (c) => getBookTexts(c),
  export_clan_book: exportClanBook,
  update_book_texts: updateBookTexts,
  ...RESOURCE_OPS,
};
