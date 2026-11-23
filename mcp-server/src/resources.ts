/**
 * Thao tác CRUD cho Bảng tin, Phòng ký ức, Ảnh ghép, Di sản, Mộ phần, Quỹ họ, Bảng vàng, Dòng thời gian (dòng họ + từng người), Liên kết dòng họ và thống kê Bản đồ.
 * Khai báo trường nằm ở resourceDefs.ts; file này là phần thực thi.
 *
 * Quyền (hai lớp, giống ops.ts):
 *  1. Gói của token: tool ghi chỉ gói `write`/`admin` gọi được (kiểm ở handler theo `needs` trong spec).
 *  2. RLS của app: mọi truy vấn chạy bằng client mang JWT của CHỦ TOKEN, nên vai trò thật của họ trong dòng họ quyết định
 *     (đa số mục cần quyền biên tập; Bảng tin: thành viên viết bài chờ duyệt, quản trị mới đăng thẳng/kiểm duyệt).
 *
 * RLS KHÔNG đủ trong ba chuyện — nên code tự kiểm, nếu không một token gắn nhiều dòng họ (hoặc admin hệ thống) có thể
 * bị lái sang dòng họ khác mà người dùng cũng có quyền:
 *  - mọi truy vấn/ghi đều lọc `clan_id` = dòng họ đang chọn của token;
 *  - id CHA (di sản, mộ phần, phòng, bức ảnh ghép, bài đăng) phải thuộc dòng họ đó trước khi thao tác con/RPC;
 *  - `person_id`, `event_id` gắn vào bản ghi phải thuộc cùng dòng họ (khoá ngoại không tự kiểm điều này).
 * Ngoài ra: chỉ nhận trường đã khai báo (không có mass-assignment), link ảnh/mô hình chỉ https, mọi lệnh xoá đòi confirm.
 */

import { EXTRA_SPECS, RESOURCES, TIMELINE_ICONS, type FieldDef, type ResourceDef } from "./resourceDefs.ts";
import { UserError, UUID_RE } from "./fields.ts";
import { LINK_OPS } from "./links.ts";
import { eraOfYear, SCENE_IDS, TIMELINE_ERAS, TIMELINE_SCENES, TIMELINE_TEMPLATES } from "./timelineData.ts";
import type { Ctx } from "./ops.ts";

type Args = Record<string, unknown>;

const DENIED = "Không ghi được: không tìm thấy, hoặc chủ token không đủ quyền với thao tác này.";
const MAX_LIST = 50;
const CLIP = 400;

const uuid = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(`${name} phải là id (UUID) — lấy từ tool list_* tương ứng.`);
  return v;
};

const needConfirm = (a: Args) => {
  if (a.confirm !== true) throw new UserError("Cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu rõ ràng.");
};

/** Id của người trong CHÍNH dòng họ này (khoá ngoại person_id không tự kiểm cùng dòng họ). */
async function personInClan(c: Ctx, id: unknown, name = "person_id"): Promise<string> {
  const pid = uuid(id, name);
  const { data, error } = await c.db.from("persons").select("id").eq("clan_id", c.clanId).eq("id", pid).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError(`${name} không thuộc dòng họ này (xem search_person).`);
  return pid;
}

/** Bản ghi cha phải thuộc dòng họ đang chọn (và chưa xoá mềm nếu bảng có xoá mềm). */
async function parentInClan(c: Ctx, table: string, id: unknown, name: string, soft: boolean): Promise<string> {
  const pid = uuid(id, name);
  let q = c.db.from(table).select("id").eq("clan_id", c.clanId).eq("id", pid);
  if (soft) q = q.is("deleted_at", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError(`${name} không thuộc dòng họ này hoặc không tồn tại.`);
  return pid;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Kiểm một giá trị theo khai báo trường; trả giá trị đã chuẩn hoá. */
async function check(c: Ctx, name: string, f: FieldDef, v: unknown): Promise<unknown> {
  if (v === null) {
    if ("req" in f && f.req) throw new UserError(`${name} không được để trống.`);
    return null;
  }
  switch (f.k) {
    case "str": {
      if (typeof v !== "string") throw new UserError(`${name} phải là chuỗi.`);
      const t = v.trim();
      if (t.length > f.max) throw new UserError(`${name} quá dài (tối đa ${f.max}).`);
      if (!t && f.req) throw new UserError(`${name} không được để trống.`);
      return t || null;
    }
    case "url": {
      if (typeof v !== "string") throw new UserError(`${name} phải là chuỗi.`);
      const t = v.trim();
      if (!t) return null;
      if (t.length > f.max || !/^https:\/\/[^\s]+$/i.test(t)) throw new UserError(`${name} phải là liên kết https hợp lệ.`);
      return t;
    }
    case "image": {
      if (typeof v !== "string") throw new UserError(`${name} phải là chuỗi.`);
      const t = v.trim();
      if (!t) return null;
      if (t.length > f.max) throw new UserError(`${name} quá dài (tối đa ${f.max}).`);
      if (t.startsWith("lib:")) {
        if (!SCENE_IDS.includes(t.slice(4))) throw new UserError(`${name}: cảnh "${t.slice(4)}" không có trong thư viện. Xem list_timeline_library (scenes).`);
        return t;
      }
      if (!/^https:\/\/[^\s]+$/i.test(t)) throw new UserError(`${name} phải là liên kết https hoặc lib:<id cảnh>.`);
      return t;
    }
    case "enum":
      if (typeof v !== "string" || !f.v.includes(v)) throw new UserError(`${name} phải là một trong: ${f.v.join(", ")}.`);
      return v;
    case "int":
      if (!Number.isInteger(v) || (v as number) < f.min || (v as number) > f.max) throw new UserError(`${name} phải là số nguyên ${f.min}–${f.max}.`);
      return v;
    case "num":
      if (typeof v !== "number" || !Number.isFinite(v) || (f.gt ? v <= f.min : v < f.min) || (f.max !== undefined && v > f.max)) {
        throw new UserError(`${name} phải là số ${f.gt ? ">" : "≥"} ${f.min}${f.max !== undefined ? ` và ≤ ${f.max}` : ""}.`);
      }
      return v;
    case "bool":
      if (typeof v !== "boolean") throw new UserError(`${name} phải là true/false.`);
      return v;
    case "date":
      if (typeof v !== "string" || !isDate(v)) throw new UserError(`${name} phải dạng YYYY-MM-DD.`);
      return v;
    case "person":
      return personInClan(c, v, name);
    case "uuid": {
      const id = uuid(v, name);
      // event_id của bài đăng: sự kiện phải thuộc dòng họ này.
      if (name === "event_id") await parentInClan(c, "events", id, name, false);
      return id;
    }
  }
}

/** Đọc các trường của tài nguyên từ đầu vào; từ chối khoá lạ (không cho ghi cột ngoài danh sách). */
async function parseFields(c: Ctx, r: ResourceDef, a: Args, creating: boolean, metaKeys: string[], allowEmpty = false): Promise<Record<string, unknown>> {
  for (const k of Object.keys(a)) {
    if (!(k in r.fields) && !metaKeys.includes(k)) throw new UserError(`Trường "${k}" không được phép. Cho phép: ${Object.keys(r.fields).join(", ")}.`);
  }
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(r.fields)) {
    if (a[k] === undefined) {
      if (creating && "req" in f && f.req) throw new UserError(`${k} là bắt buộc.`);
      continue;
    }
    out[k] = await check(c, k, f, a[k]);
  }
  if (Object.keys(out).length === 0 && !allowEmpty) throw new UserError("Không có trường nào để ghi.");
  return out;
}

const clip = (v: unknown): unknown =>
  typeof v === "string" && v.length > CLIP ? `${v.slice(0, CLIP)}… (đã cắt bớt — gọi lại với id để đọc đủ)` : v;

// ─── CRUD chung ────────────────────────────────────────────────────────

async function listOf(r: ResourceDef, c: Ctx, a: Args): Promise<string> {
  const allowed = ["id", "q", "limit", "offset", ...(r.filters ?? [])];
  for (const k of Object.keys(a)) if (!allowed.includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ. Cho phép: ${allowed.join(", ")}.`);
  const limit = Math.min(Math.max(Number.isInteger(a.limit) ? (a.limit as number) : 25, 1), MAX_LIST);
  const offset = Math.max(Number.isInteger(a.offset) ? (a.offset as number) : 0, 0);
  const cols = ["id", ...Object.keys(r.fields), ...(r.extraCols ?? [])].join(", ");
  let q = c.db.from(r.table).select(cols, { count: "exact" }).eq("clan_id", c.clanId);
  if (r.soft) q = q.is("deleted_at", null);
  if (a.id !== undefined) q = q.eq("id", uuid(a.id, "id"));
  if (a.q !== undefined && r.searchCol) {
    if (typeof a.q !== "string") throw new UserError("q phải là chuỗi.");
    q = q.ilike(r.searchCol, `%${a.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  for (const f of r.filters ?? []) {
    if (a[f] === undefined) continue;
    if (a[f] === null) throw new UserError(`${f} không được null.`);
    await check(c, f, r.fields[f], a[f]);
    q = q.eq(f, a[f] as string);
  }
  // Bảng tin: mặc định ẩn bài đã gỡ (như app); lọc status=hidden để xem.
  if (r.key === "post" && a.status === undefined) q = q.neq("status", "hidden");
  for (const [col, asc] of r.order) q = q.order(col, { ascending: asc, nullsFirst: false });
  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (!rows.length) return `Không có ${r.plural.replace(/_/g, " ")} nào${a.id !== undefined || a.q !== undefined ? " khớp" : ""}.`;
  const out = a.id !== undefined ? rows : rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, clip(v)])));
  return JSON.stringify({ total: count ?? rows.length, shown: rows.length, offset, rows: out }, null, 1);
}

/** Chuẩn hoá nội dung bối cảnh tự viết: mỗi dòng một ý (≤6 ý, ≤160 ký tự/ý) — khớp textToBullets của app. */
function normContext(title: unknown, body: unknown): { context_title: string; context_body: string } {
  const t = typeof title === "string" ? title.trim() : "";
  const bullets = (typeof body === "string" ? body : "")
    .split("\n")
    .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
  if (!t || bullets.length === 0) throw new UserError("Bối cảnh tự viết cần context_title và ít nhất một dòng ở context_body (muốn ẩn thẻ: hide_context=true; muốn theo thời đại mặc định: bỏ trống cả hai).");
  if (bullets.length > 6) throw new UserError("context_body tối đa 6 dòng (mỗi dòng một ý).");
  if (bullets.some((l) => l.length > 160)) throw new UserError("Mỗi ý trong context_body tối đa 160 ký tự.");
  return { context_title: t.slice(0, 200), context_body: bullets.join("\n") };
}

/**
 * Bối cảnh thời đại của mốc dòng thời gian — ba cách, chỉ chọn MỘT:
 *  - fill_context=true: chép bối cảnh của thời đại CHỨA năm của mốc (xem list_timeline_library);
 *  - hide_context=true: ẩn thẻ bối cảnh;
 *  - context_title + context_body: tự viết.
 * Không chọn cách nào = giữ nguyên (mốc mới: app tự lấy bối cảnh mặc định theo năm).
 */
function contextPatch(a: Args, patch: Record<string, unknown>, year: number | null): Record<string, unknown> {
  for (const k of ["fill_context", "hide_context"]) if (a[k] !== undefined && typeof a[k] !== "boolean") throw new UserError(`${k} phải là true/false.`);
  const fill = a.fill_context === true;
  const hide = a.hide_context === true;
  const custom = patch.context_title != null || patch.context_body != null;
  if ([fill, hide, custom].filter(Boolean).length > 1) throw new UserError("Chỉ chọn MỘT cách đặt bối cảnh: fill_context, hide_context, hoặc context_title + context_body.");
  if (fill) {
    const era = year === null ? null : eraOfYear(year);
    if (!era) throw new UserError(`Không có thời đại nào trong thư viện chứa năm ${year ?? "?"} (thư viện bắt đầu từ năm 1009). Hãy tự viết context_title + context_body hoặc hide_context.`);
    return { context_title: era.title, context_body: era.bullets.join("\n") };
  }
  if (hide) return { context_title: "", context_body: "" };
  if (custom) return normContext(patch.context_title, patch.context_body);
  return {};
}

async function createOf(r: ResourceDef, c: Ctx, a: Args): Promise<string> {
  const patch = await parseFields(c, r, a, true, r.metaKeys ?? []);
  const extra = r.key === "timeline_milestone" ? contextPatch(a, patch, typeof patch.year === "number" ? patch.year : null) : {};
  const { data, error } = await c.db.from(r.table).insert({ ...patch, ...extra, clan_id: c.clanId }).select("id").single();
  if (error) throw new UserError(error.message);
  return `Đã tạo ${r.key.replace(/_/g, " ")} (id ${data.id}).`;
}

async function updateOf(r: ResourceDef, c: Ctx, a: Args): Promise<string> {
  const idKey = `${r.key}_id`;
  const id = uuid(a[idKey], idKey);
  const metaKeys = r.metaKeys ?? [];
  const patch = await parseFields(c, r, a, false, [idKey, ...metaKeys], metaKeys.some((k) => a[k] !== undefined));
  let extra: Record<string, unknown> = {};
  if (r.key === "timeline_milestone") {
    let year = typeof patch.year === "number" ? patch.year : null;
    if (year === null && a.fill_context === true) {
      const { data: cur } = await c.db.from(r.table).select("year").eq("clan_id", c.clanId).eq("id", id).maybeSingle();
      year = (cur?.year as number | undefined) ?? null;
    }
    extra = contextPatch(a, patch, year);
  }
  const all = { ...patch, ...extra };
  if (Object.keys(all).length === 0) throw new UserError("Không có trường nào để ghi.");
  let q = c.db.from(r.table).update(all).eq("clan_id", c.clanId).eq("id", id);
  if (r.soft) q = q.is("deleted_at", null);
  const { data, error } = await q.select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã cập nhật ${r.key.replace(/_/g, " ")}.` : DENIED;
}

async function deleteOf(r: ResourceDef, c: Ctx, a: Args): Promise<string> {
  const idKey = `${r.key}_id`;
  for (const k of Object.keys(a)) if (![idKey, "confirm"].includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ.`);
  const id = uuid(a[idKey], idKey);
  needConfirm(a);
  const q = r.soft
    ? c.db.from(r.table).update({ deleted_at: new Date().toISOString() }).eq("clan_id", c.clanId).eq("id", id).is("deleted_at", null)
    : c.db.from(r.table).delete().eq("clan_id", c.clanId).eq("id", id);
  const { data, error } = await q.select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã xoá ${r.key.replace(/_/g, " ")}.` : DENIED;
}

// ─── Bảng tin ──────────────────────────────────────────────────────────

const POST = RESOURCES.find((r) => r.key === "post")!;

/** Quản trị dòng họ đăng thẳng; thành viên khác bắt buộc vào hàng chờ duyệt (RLS cũng ép như vậy). */
async function createPost(c: Ctx, a: Args): Promise<string> {
  const patch = await parseFields(c, POST, a, true, []);
  const { data: isAdmin } = await c.db.rpc("is_clan_admin", { target_clan: c.clanId });
  const status = isAdmin === true ? "published" : "pending";
  const { data, error } = await c.db.from("clan_posts").insert({ ...patch, clan_id: c.clanId, author_id: c.userId, status }).select("id").single();
  if (error) throw new UserError(error.message);
  return status === "published"
    ? `Đã đăng bài lên Bảng tin (id ${data.id}).`
    : `Đã gửi bài (id ${data.id}) — đang chờ quản trị dòng họ duyệt mới hiện trên Bảng tin.`;
}

/** Bài phải thuộc dòng họ đang chọn: RPC kiểm duyệt chỉ kiểm quyền ở dòng họ CỦA BÀI nên phải tự kiểm trước. */
async function moderate(c: Ctx, postId: string, action: string, note: unknown): Promise<string> {
  await parentInClan(c, "clan_posts", postId, "post_id", false);
  const n = note === undefined ? undefined : typeof note === "string" && note.length <= 500 ? note : (() => { throw new UserError("note tối đa 500 ký tự."); })();
  const { error } = await c.db.rpc("clan_post_moderate", { p_post_id: postId, p_action: action, p_note: n });
  if (error) throw new UserError(error.message);
  return "Đã kiểm duyệt bài.";
}

const POST_ACTIONS = ["publish", "reject", "hide", "unhide", "pin", "unpin"];
async function moderatePost(c: Ctx, a: Args): Promise<string> {
  for (const k of Object.keys(a)) if (!["post_id", "action", "note"].includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ.`);
  if (typeof a.action !== "string" || !POST_ACTIONS.includes(a.action)) throw new UserError(`action phải là: ${POST_ACTIONS.join(", ")}.`);
  return moderate(c, uuid(a.post_id, "post_id"), a.action, a.note);
}

async function deletePost(c: Ctx, a: Args): Promise<string> {
  for (const k of Object.keys(a)) if (!["post_id", "confirm"].includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ.`);
  const id = uuid(a.post_id, "post_id");
  needConfirm(a);
  await moderate(c, id, "hide", undefined);
  return "Đã gỡ bài khỏi Bảng tin (ẩn, nhật ký kiểm duyệt vẫn giữ).";
}

// ─── Quỹ họ ────────────────────────────────────────────────────────────

async function fundSummary(c: Ctx, a: Args): Promise<string> {
  for (const k of Object.keys(a)) if (!["from", "to"].includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ.`);
  let q = c.db.from("fund_transactions").select("direction, amount, fund").eq("clan_id", c.clanId).is("deleted_at", null);
  if (a.from !== undefined) q = q.gte("occurred_on", String(await check(c, "from", { k: "date" }, a.from)));
  if (a.to !== undefined) q = q.lte("occurred_on", String(await check(c, "to", { k: "date" }, a.to)));
  const { data, error } = await q.range(0, 9999);
  if (error) throw new Error(error.message);
  const funds = new Map<string, { in: number; out: number }>();
  let tin = 0;
  let tout = 0;
  for (const t of data ?? []) {
    const amt = Number(t.amount);
    const f = funds.get(t.fund as string) ?? { in: 0, out: 0 };
    if (t.direction === "in") { f.in += amt; tin += amt; } else { f.out += amt; tout += amt; }
    funds.set(t.fund as string, f);
  }
  return JSON.stringify(
    {
      giao_dich: data?.length ?? 0,
      tong_thu: tin,
      tong_chi: tout,
      so_du: tin - tout,
      theo_quy: [...funds].map(([fund, v]) => ({ fund, thu: v.in, chi: v.out, so_du: v.in - v.out })).sort((x, y) => x.fund.localeCompare(y.fund, "vi")),
    },
    null,
    1,
  );
}

// ─── Mục con ───────────────────────────────────────────────────────────

function only(a: Args, keys: string[]) {
  for (const k of Object.keys(a)) if (!keys.includes(k)) throw new UserError(`Tham số "${k}" không hợp lệ. Cho phép: ${keys.join(", ")}.`);
}
const shortText = (c: Ctx, name: string, v: unknown, max: number) => check(c, name, { k: "str", max }, v);

async function addHeritagePerson(c: Ctx, a: Args): Promise<string> {
  only(a, ["heritage_item_id", "person_id", "role_note"]);
  const item = await parentInClan(c, "heritage_items", a.heritage_item_id, "heritage_item_id", true);
  const person = await personInClan(c, a.person_id);
  const role_note = a.role_note === undefined ? null : await shortText(c, "role_note", a.role_note, 300);
  const { error } = await c.db.from("heritage_people").insert({ item_id: item, person_id: person, clan_id: c.clanId, role_note });
  if (error) throw new UserError(error.message);
  return "Đã gắn người vào mục di sản.";
}

async function removeHeritagePerson(c: Ctx, a: Args): Promise<string> {
  only(a, ["heritage_item_id", "person_id", "confirm"]);
  needConfirm(a);
  const item = await parentInClan(c, "heritage_items", a.heritage_item_id, "heritage_item_id", true);
  const { data, error } = await c.db.from("heritage_people").delete().eq("clan_id", c.clanId).eq("item_id", item).eq("person_id", uuid(a.person_id, "person_id")).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã gỡ người khỏi mục di sản." : DENIED;
}

async function addOccupant(c: Ctx, a: Args): Promise<string> {
  only(a, ["resting_place_id", "person_id", "note"]);
  const place = await parentInClan(c, "resting_places", a.resting_place_id, "resting_place_id", true);
  const person = await personInClan(c, a.person_id);
  const note = a.note === undefined ? null : await shortText(c, "note", a.note, 300);
  const { error } = await c.db.from("resting_place_occupants").insert({ resting_place_id: place, person_id: person, clan_id: c.clanId, note });
  if (error) throw new UserError(error.message);
  return "Đã ghi nhận người an nghỉ tại nơi này.";
}

async function removeOccupant(c: Ctx, a: Args): Promise<string> {
  only(a, ["resting_place_id", "person_id", "confirm"]);
  needConfirm(a);
  const place = await parentInClan(c, "resting_places", a.resting_place_id, "resting_place_id", true);
  const { data, error } = await c.db.from("resting_place_occupants").delete().eq("clan_id", c.clanId).eq("resting_place_id", place).eq("person_id", uuid(a.person_id, "person_id")).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã gỡ người khỏi nơi an nghỉ." : DENIED;
}

async function listOccupants(c: Ctx, a: Args): Promise<string> {
  only(a, ["resting_place_id"]);
  const place = await parentInClan(c, "resting_places", a.resting_place_id, "resting_place_id", true);
  const { data, error } = await c.db.from("resting_place_occupants").select("person_id, note").eq("clan_id", c.clanId).eq("resting_place_id", place);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Chưa ghi nhận ai an nghỉ tại nơi này.";
  const { data: ps } = await c.db.from("persons").select("id, full_name").eq("clan_id", c.clanId).in("id", data.map((o) => o.person_id as string));
  const name = new Map((ps ?? []).map((p) => [p.id as string, p.full_name as string]));
  return data.map((o) => `${o.person_id} · ${name.get(o.person_id as string) ?? "?"}${o.note ? ` · ${o.note}` : ""}`).join("\n");
}

async function addRelocation(c: Ctx, a: Args): Promise<string> {
  only(a, ["resting_place_id", "from_label", "moved_on", "note"]);
  const place = await parentInClan(c, "resting_places", a.resting_place_id, "resting_place_id", true);
  const row = {
    resting_place_id: place,
    clan_id: c.clanId,
    from_label: a.from_label === undefined ? null : await shortText(c, "from_label", a.from_label, 300),
    moved_on: a.moved_on === undefined ? null : await check(c, "moved_on", { k: "date" }, a.moved_on),
    note: a.note === undefined ? null : await shortText(c, "note", a.note, 1000),
  };
  const { error } = await c.db.from("resting_place_relocations").insert(row);
  if (error) throw new UserError(error.message);
  return "Đã ghi nhận lần dời mộ.";
}

// ─── Phòng ký ức ───────────────────────────────────────────────────────

async function listRoomItems(c: Ctx, a: Args): Promise<string> {
  only(a, ["memory_room_id"]);
  const room = await parentInClan(c, "memory_rooms", a.memory_room_id, "memory_room_id", true);
  const { data, error } = await c.db.from("memory_room_items").select("id, kind, person_id, image_url, model_url, caption, subtitle, sort").eq("clan_id", c.clanId).eq("room_id", room).order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data?.length ? JSON.stringify(data, null, 1) : "Phòng chưa có khung ảnh nào.";
}

async function addRoomItem(c: Ctx, a: Args): Promise<string> {
  only(a, ["memory_room_id", "kind", "person_id", "image_url", "model_url", "caption", "subtitle"]);
  const room = await parentInClan(c, "memory_rooms", a.memory_room_id, "memory_room_id", true);
  const kind = await check(c, "kind", { k: "enum", v: ["photo", "model"], req: true }, a.kind);
  const row: Record<string, unknown> = { room_id: room, clan_id: c.clanId, kind };
  if (kind === "photo") {
    if (a.model_url !== undefined) throw new UserError("Khung ảnh không dùng model_url.");
    const hasP = a.person_id !== undefined && a.person_id !== null;
    const hasU = a.image_url !== undefined && a.image_url !== null;
    if (hasP === hasU) throw new UserError("Khung ảnh cần ĐÚNG MỘT trong person_id (ảnh của thành viên) hoặc image_url (link https).");
    if (hasP) row.person_id = await personInClan(c, a.person_id);
    else row.image_url = await check(c, "image_url", { k: "url", max: 1000 }, a.image_url);
  } else {
    if (a.person_id !== undefined || a.image_url !== undefined) throw new UserError("Hiện vật 3D chỉ dùng model_url.");
    if (a.model_url === undefined || a.model_url === null) throw new UserError("kind=model cần model_url (link https tới GLB/GLTF).");
    row.model_url = await check(c, "model_url", { k: "url", max: 1000 }, a.model_url);
  }
  if (a.caption !== undefined) row.caption = await shortText(c, "caption", a.caption, 300);
  if (a.subtitle !== undefined) row.subtitle = await shortText(c, "subtitle", a.subtitle, 300);
  const { data, error } = await c.db.from("memory_room_items").insert(row).select("id").single();
  if (error) throw new UserError(error.message);
  return `Đã thêm khung vào phòng (id ${data.id}).`;
}

async function updateRoomItem(c: Ctx, a: Args): Promise<string> {
  only(a, ["item_id", "caption", "subtitle"]);
  const id = uuid(a.item_id, "item_id");
  const patch: Record<string, unknown> = {};
  if (a.caption !== undefined) patch.caption = await shortText(c, "caption", a.caption, 300);
  if (a.subtitle !== undefined) patch.subtitle = await shortText(c, "subtitle", a.subtitle, 300);
  if (!Object.keys(patch).length) throw new UserError("Không có trường nào để ghi.");
  const { data, error } = await c.db.from("memory_room_items").update(patch).eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã cập nhật khung." : DENIED;
}

async function removeRoomItem(c: Ctx, a: Args): Promise<string> {
  only(a, ["item_id", "confirm"]);
  const id = uuid(a.item_id, "item_id");
  needConfirm(a);
  const { data, error } = await c.db.from("memory_room_items").delete().eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã gỡ khung khỏi phòng." : DENIED;
}

// ─── Ảnh ghép ──────────────────────────────────────────────────────────

async function setMosaicDashboard(c: Ctx, a: Args): Promise<string> {
  only(a, ["mosaic_id", "on"]);
  const id = await parentInClan(c, "clan_mosaics", a.mosaic_id, "mosaic_id", false);
  if (typeof a.on !== "boolean") throw new UserError("on phải là true/false.");
  // Chỉ một bức hiện ở Tổng quan: bật bức này thì gỡ cờ của các bức khác trong họ (giống app).
  if (a.on) {
    const { error: e1 } = await c.db.from("clan_mosaics").update({ show_on_dashboard: false }).eq("clan_id", c.clanId).neq("id", id);
    if (e1) throw new UserError(e1.message);
  }
  const { data, error } = await c.db.from("clan_mosaics").update({ show_on_dashboard: a.on }).eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? (a.on ? "Đã hiện bức ảnh ghép này ở Tổng quan." : "Đã gỡ bức ảnh ghép khỏi Tổng quan.") : DENIED;
}

async function listTiles(c: Ctx, a: Args): Promise<string> {
  only(a, ["mosaic_id"]);
  const m = await parentInClan(c, "clan_mosaics", a.mosaic_id, "mosaic_id", false);
  const { data, error } = await c.db.from("clan_mosaic_tiles").select("id, user_id, person_id, caption, status, position, created_at").eq("clan_id", c.clanId).eq("mosaic_id", m).order("position", { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  return data?.length ? JSON.stringify(data, null, 1) : "Bức ảnh ghép chưa có mảnh nào.";
}

async function setTileStatus(c: Ctx, a: Args): Promise<string> {
  only(a, ["tile_id", "status"]);
  const id = uuid(a.tile_id, "tile_id");
  const status = await check(c, "status", { k: "enum", v: ["approved", "hidden"], req: true }, a.status);
  const { data, error } = await c.db.from("clan_mosaic_tiles").update({ status }).eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã đặt mảnh ghép: ${status}.` : DENIED;
}

async function deleteTile(c: Ctx, a: Args): Promise<string> {
  only(a, ["tile_id", "confirm"]);
  const id = uuid(a.tile_id, "tile_id");
  needConfirm(a);
  const { data: tile } = await c.db.from("clan_mosaic_tiles").select("id, photo_path").eq("clan_id", c.clanId).eq("id", id).maybeSingle();
  const { data, error } = await c.db.from("clan_mosaic_tiles").delete().eq("clan_id", c.clanId).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  if (!data?.length) return DENIED;
  // Chỉ dọn ảnh do chính tính năng tải lên; ảnh thành viên và link ngoài là ảnh dùng chung (giống app).
  if (tile && typeof tile.photo_path === "string" && tile.photo_path.includes("/mosaic/")) {
    await c.db.storage.from("person-photos").remove([tile.photo_path]);
  }
  return "Đã xoá mảnh ghép.";
}

// ─── Dòng thời gian một người ──────────────────────────────────────────
// Cùng kho `clan_timeline_milestones` với poster dòng họ (mốc có person_id). CRUD tổng quát của kho nằm ở
// list/create/update/delete_timeline_milestone (RESOURCES); hai tool dưới đây là lối tắt theo từng người.

const MAX_TIMELINE = 100;
const TIMELINE_ICON_FIELD: FieldDef = { k: "enum", v: TIMELINE_ICONS };
/** Tiêu đề tối đa khi suy từ nội dung (khớp migration gộp person_timeline). */
const DERIVE_TITLE = 120;

/** Chỉ có nội dung: ≤120 ký tự thì làm tiêu đề, dài hơn thì cắt làm tiêu đề và giữ nguyên văn ở `body`. */
function titleBody(title: string | null, body: string | null): { title: string; body: string | null } {
  if (title) return { title, body };
  const b = body ?? "";
  return b.length <= DERIVE_TITLE ? { title: b, body: null } : { title: `${b.slice(0, DERIVE_TITLE - 3)}…`, body: b };
}

async function getTimeline(c: Ctx, a: Args): Promise<string> {
  only(a, ["person_id"]);
  const person = await personInClan(c, a.person_id);
  const { data, error } = await c.db
    .from("clan_timeline_milestones")
    .select("id, year, era, title, body, on_clan, sort_order")
    .eq("clan_id", c.clanId)
    .eq("person_id", person)
    .order("year")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data?.length ? JSON.stringify(data, null, 1) : "Người này chưa có mốc nào trong dòng thời gian.";
}

async function setTimeline(c: Ctx, a: Args): Promise<string> {
  only(a, ["person_id", "entries", "mode", "confirm"]);
  const person = await personInClan(c, a.person_id);
  const mode = a.mode === undefined ? "append" : await check(c, "mode", { k: "enum", v: ["append", "replace"], req: true }, a.mode);
  if (!Array.isArray(a.entries)) throw new UserError("entries phải là mảng các mốc {year, title?, body?, era?, on_clan?}.");
  if (a.entries.length > MAX_TIMELINE) throw new UserError(`Tối đa ${MAX_TIMELINE} mốc mỗi lần.`);
  const rows: { year: number; era: string | null; title: string; body: string | null; on_clan: boolean; icon_key: string | null; image_url: string | null; context_title: string | null; context_body: string | null }[] = [];
  for (const [i, e] of a.entries.entries()) {
    if (!e || typeof e !== "object" || Array.isArray(e)) throw new UserError(`entries[${i}] phải là object {year, title?, body?, era?, on_clan?}.`);
    const en = e as Args;
    const ENTRY_KEYS = ["year", "era", "title", "body", "on_clan", "icon_key", "image_url", "context_title", "context_body", "hide_context"];
    for (const k of Object.keys(en)) if (!ENTRY_KEYS.includes(k)) throw new UserError(`entries[${i}].${k} không hợp lệ. Cho phép: ${ENTRY_KEYS.join(", ")}.`);
    const year = (await check(c, `entries[${i}].year`, { k: "int", min: -3000, max: 9999, req: true }, en.year)) as number;
    const title = en.title === undefined ? null : ((await shortText(c, `entries[${i}].title`, en.title, 200)) as string | null);
    const body = en.body === undefined ? null : ((await shortText(c, `entries[${i}].body`, en.body, 2000)) as string | null);
    if (!title && !body) throw new UserError(`entries[${i}] cần title hoặc body.`);
    const era = en.era === undefined ? null : ((await shortText(c, `entries[${i}].era`, en.era, 40)) as string | null);
    const on_clan = en.on_clan === undefined ? false : ((await check(c, `entries[${i}].on_clan`, { k: "bool" }, en.on_clan)) as boolean);
    const icon_key = en.icon_key === undefined ? null : ((await check(c, `entries[${i}].icon_key`, TIMELINE_ICON_FIELD, en.icon_key)) as string | null);
    const image_url = en.image_url === undefined ? null : ((await check(c, `entries[${i}].image_url`, { k: "image", max: 500 }, en.image_url)) as string | null);
    const ctx = contextPatch(
      { hide_context: en.hide_context },
      { context_title: en.context_title === undefined ? null : await shortText(c, `entries[${i}].context_title`, en.context_title, 200), context_body: en.context_body === undefined ? null : await shortText(c, `entries[${i}].context_body`, en.context_body, 1000) },
      year,
    );
    rows.push({ year, era, on_clan, icon_key, image_url, context_title: (ctx.context_title as string | undefined) ?? null, context_body: (ctx.context_body as string | undefined) ?? null, ...titleBody(title, body) });
  }

  // "Mốc riêng" của người = mốc KHÔNG hiện trên poster dòng họ; thay thế chỉ đụng nhóm này.
  const { data: old, error: e0 } = await c.db.from("clan_timeline_milestones").select("id, sort_order, on_clan").eq("clan_id", c.clanId).eq("person_id", person);
  if (e0) throw new Error(e0.message);
  const own = (old ?? []).filter((o) => o.on_clan === false);
  if (mode === "replace" && own.length) needConfirm(a);
  if (mode === "append" && !rows.length) throw new UserError("entries rỗng — không có gì để thêm.");

  const base = mode === "append" ? Math.max(-1, ...(old ?? []).map((o) => o.sort_order as number)) + 1 : 0;
  if (rows.length) {
    const { error } = await c.db.from("clan_timeline_milestones").insert(
      rows.map((r, i) => ({
        ...r,
        clan_id: c.clanId,
        person_id: person,
        sort_order: Math.min(999, base + i),
        // Không chọn bối cảnh riêng thì context = null → app tự lấy bối cảnh mặc định theo năm (poster hiển thị đủ layout).
      })),
    );
    if (error) throw new UserError(error.message);
  }
  // Thay thế: chèn bản mới trước rồi mới xoá bản cũ (giống app) — lỗi giữa chừng không làm mất mốc đã có.
  if (mode === "replace" && own.length) {
    const { error } = await c.db.from("clan_timeline_milestones").delete().eq("clan_id", c.clanId).in("id", own.map((o) => o.id as string));
    if (error) throw new UserError(error.message);
  }
  return mode === "append"
    ? `Đã thêm ${rows.length} mốc vào dòng thời gian (tổng ${(old?.length ?? 0) + rows.length}).`
    : `Đã thay dòng thời gian: ${rows.length} mốc (bỏ ${own.length} mốc cũ).`;
}

// ─── Thư viện dòng thời gian ───────────────────────────────────────────

async function timelineLibrary(_c: Ctx, a: Args): Promise<string> {
  only(a, ["year"]);
  let eras = TIMELINE_ERAS;
  if (a.year !== undefined) {
    const y = (await check(_c, "year", { k: "int", min: -3000, max: 9999 }, a.year)) as number;
    const e = eraOfYear(y);
    eras = e ? [e] : [];
  }
  return JSON.stringify(
    {
      note: "context: fill_context=true copies the era covering the milestone's year; image_url `lib:<scene id>`; icon_key from icons.",
      icons: TIMELINE_ICONS,
      eras: eras.map((e) => ({ id: e.id, years: `${e.from}–${e.to}`, title: e.title, bullets: e.bullets })),
      scenes: TIMELINE_SCENES,
      templates: TIMELINE_TEMPLATES,
    },
    null,
    1,
  );
}

// ─── Bản đồ ────────────────────────────────────────────────────────────

async function mapStats(c: Ctx, a: Args): Promise<string> {
  only(a, ["include_deceased"]);
  if (a.include_deceased !== undefined && typeof a.include_deceased !== "boolean") throw new UserError("include_deceased phải là true/false.");
  const { data, error } = await c.db.rpc("clan_map_stats", { p_clan: c.clanId, p_include_deceased: a.include_deceased ?? true });
  if (error) throw new UserError(error.message);
  return JSON.stringify(data, null, 1);
}

// ─── Đăng ký ───────────────────────────────────────────────────────────

export const RESOURCE_OPS: Record<string, (c: Ctx, a: Args) => Promise<string>> = {
  create_post: createPost,
  moderate_post: moderatePost,
  delete_post: deletePost,
  fund_summary: fundSummary,
  add_heritage_person: addHeritagePerson,
  remove_heritage_person: removeHeritagePerson,
  add_resting_place_occupant: addOccupant,
  remove_resting_place_occupant: removeOccupant,
  list_resting_place_occupants: listOccupants,
  add_resting_place_relocation: addRelocation,
  list_memory_room_items: listRoomItems,
  add_memory_room_item: addRoomItem,
  update_memory_room_item: updateRoomItem,
  remove_memory_room_item: removeRoomItem,
  set_mosaic_dashboard: setMosaicDashboard,
  list_mosaic_tiles: listTiles,
  set_mosaic_tile_status: setTileStatus,
  delete_mosaic_tile: deleteTile,
  get_person_timeline: getTimeline,
  set_person_timeline: setTimeline,
  map_stats: mapStats,
  list_timeline_library: timelineLibrary,
  ...LINK_OPS,
};

for (const r of RESOURCES) {
  RESOURCE_OPS[`list_${r.plural}`] = (c, a) => listOf(r, c, a);
  if (!r.customCreate) RESOURCE_OPS[`create_${r.key}`] = (c, a) => createOf(r, c, a);
  RESOURCE_OPS[`update_${r.key}`] = (c, a) => updateOf(r, c, a);
  if (!r.customDelete) RESOURCE_OPS[`delete_${r.key}`] = (c, a) => deleteOf(r, c, a);
}

/** Mọi tên tool do file này xử lý — test đối chiếu với spec để không có tool thiếu hàm hoặc hàm thiếu spec. */
export const RESOURCE_TOOL_NAMES = Object.keys(RESOURCE_OPS);
export const _EXTRA_SPEC_NAMES = EXTRA_SPECS.map((t) => t.name);
