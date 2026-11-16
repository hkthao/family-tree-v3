/**
 * Chức năng QUẢN TRỊ HỆ THỐNG cho token admin (gói `admin`).
 *
 * Vẫn chạy bằng JWT của chủ token — một admin hệ thống thật — nên RLS cho phép đúng những gì admin UI làm được; không có
 * quyền nào "lớn hơn" app. Quy ước an toàn:
 *  - thao tác không hoàn tác / ảnh hưởng toàn nền tảng (xoá tài khoản, khoá, cấp-thu quyền admin, đổi cấu hình, xoá tin,
 *    thu hồi token) bắt buộc `confirm: true` + `reason` (≥ 5 ký tự); lý do được ghi vào `mcp_admin_log`;
 *  - không tự khoá / xoá / hạ quyền chính mình, không thu hồi token đang dùng;
 *  - không có tool xoá dòng họ hay xoá sạch danh mục: app cũng không cho admin làm việc đó bằng một cú bấm.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { UserError, UUID_RE } from "./fields.ts";

export interface AdminCtx {
  db: SupabaseClient;
  userId: string;
  tokenId: string;
  /** JWT ngắn hạn của chủ token — dùng khi phải gọi edge function `admin-action`. */
  mintJwt: () => Promise<string>;
  supabaseUrl: string;
  anonKey: string;
}
type Args = Record<string, unknown>;

const uuid = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(`${name} phải là id (UUID).`);
  return v;
};
const clampInt = (v: unknown, d: number, lo: number, hi: number) => Math.min(Math.max(Number.isInteger(v) ? (v as number) : d, lo), hi);
const day = (iso: unknown) => (typeof iso === "string" ? iso.slice(0, 10) : "—");

/** Thao tác nguy hiểm: bắt buộc confirm=true và lý do. Trả lý do đã làm sạch. */
function requireConfirm(a: Args): string {
  if (a.confirm !== true) throw new UserError("Thao tác này cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu rõ ràng đúng việc này.");
  const reason = typeof a.reason === "string" ? a.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) throw new UserError("Cần reason (5–500 ký tự) giải thích vì sao làm việc này.");
  return reason;
}
const optStr = (v: unknown, name: string, max: number): string | null => {
  if (v === null) return null;
  if (typeof v !== "string") throw new UserError(`${name} phải là chuỗi.`);
  if (v.length > max) throw new UserError(`${name} quá dài (tối đa ${max}).`);
  return v.trim() || null;
};
const isoOrNull = (v: unknown, name: string): string | null => {
  if (v === null) return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new UserError(`${name} phải là thời điểm ISO hợp lệ hoặc null.`);
  return new Date(v).toISOString();
};

// ─── Thống kê ───────────────────────────────────────────────────────────

export async function platformStats(c: AdminCtx): Promise<string> {
  const { data, error } = await c.db.rpc("get_platform_db_stats");
  if (error) throw new UserError(error.message);
  return JSON.stringify(data, null, 2);
}

export async function listFailedNotifications(c: AdminCtx): Promise<string> {
  const { data, error } = await c.db.rpc("get_platform_db_stats");
  if (error) throw new UserError(error.message);
  const rows = ((data as { recent_failed_notifications?: unknown[] } | null)?.recent_failed_notifications ?? []) as Array<Record<string, unknown>>;
  return rows.length ? JSON.stringify(rows, null, 2) : "Không có thông báo nào gửi lỗi gần đây.";
}

export async function clearFailedNotification(c: AdminCtx, a: Args): Promise<string> {
  const { error } = await c.db.rpc("clear_failed_notification", { p_id: uuid(a.notification_id, "notification_id") });
  if (error) throw new UserError(error.message);
  return "Đã bỏ qua thông báo lỗi này.";
}

// ─── Người dùng ──────────────────────────────────────────────────────────

export async function listUsers(c: AdminCtx, a: Args): Promise<string> {
  const limit = clampInt(a.limit, 30, 1, 100);
  const offset = Math.max(Number.isInteger(a.offset) ? (a.offset as number) : 0, 0);
  const { data, error } = await c.db.from("profiles").select("id, display_name, is_platform_admin, is_suspended, max_clans, created_at").order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  const profiles = data ?? [];
  const emails = new Map<string, string>();
  for (let i = 0; i < profiles.length; i += 500) {
    const { data: e } = await c.db.rpc("get_profile_emails", { user_ids: profiles.slice(i, i + 500).map((p) => p.id) });
    for (const r of (e as Array<{ id: string; email: string }> | null) ?? []) emails.set(r.id, r.email);
  }
  const q = typeof a.q === "string" ? a.q.trim().toLowerCase() : "";
  const rows = profiles.filter((p) => !q || (p.display_name ?? "").toLowerCase().includes(q) || (emails.get(p.id) ?? "").toLowerCase().includes(q));
  if (!rows.length) return "Không có tài khoản nào khớp.";
  const page = rows.slice(offset, offset + limit);
  const lines = page.map(
    (p) =>
      `${p.id} · ${p.display_name ?? "(chưa đặt tên)"} · ${emails.get(p.id) ?? "?"} · tối đa ${p.max_clans} dòng họ · tạo ${day(p.created_at)}${p.is_platform_admin ? " · ADMIN HỆ THỐNG" : ""}${p.is_suspended ? " · ĐANG KHOÁ" : ""}`,
  );
  const more = rows.length > offset + page.length ? `\n… còn ${rows.length - offset - page.length} tài khoản (offset=${offset + page.length}).` : "";
  return `Tổng ${rows.length} tài khoản, hiện ${offset + 1}–${offset + page.length}:\n${lines.join("\n")}${more}`;
}

export async function setUserLimits(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.user_id, "user_id");
  if (!Number.isInteger(a.max_clans) || (a.max_clans as number) < 0 || (a.max_clans as number) > 1000) throw new UserError("max_clans phải là số nguyên 0–1000.");
  const { data, error } = await c.db.from("profiles").update({ max_clans: a.max_clans }).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã đặt tối đa ${a.max_clans} dòng họ cho tài khoản.` : "Không tìm thấy tài khoản.";
}

const USER_ACTIONS = ["suspend", "unsuspend", "signout", "grant_platform_admin", "revoke_platform_admin", "delete"] as const;
const NEEDS_CONFIRM = new Set(["suspend", "grant_platform_admin", "revoke_platform_admin", "delete"]);

export async function userAction(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.user_id, "user_id");
  const action = String(a.action);
  if (!(USER_ACTIONS as readonly string[]).includes(action)) throw new UserError(`action phải là: ${USER_ACTIONS.join(", ")}.`);
  if (NEEDS_CONFIRM.has(action)) requireConfirm(a);
  if (id === c.userId && ["suspend", "delete", "revoke_platform_admin"].includes(action)) {
    throw new UserError("Không tự khoá / xoá / hạ quyền chính mình qua token này.");
  }
  const { data: target } = await c.db.from("profiles").select("display_name").eq("id", id).maybeSingle();
  if (!target) throw new UserError("Không tìm thấy tài khoản.");

  // Gọi chính edge function mà admin UI dùng (nó kiểm lại JWT là admin hệ thống rồi mới dùng service role).
  const body: Record<string, unknown> = { action: action === "revoke_platform_admin" ? "grant_platform_admin" : action, target_user_id: id };
  if (action === "grant_platform_admin") body.grant = true;
  if (action === "revoke_platform_admin") body.grant = false;
  const res = await fetch(`${c.supabaseUrl}/functions/v1/admin-action`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await c.mintJwt()}`, apikey: c.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !out.ok) throw new UserError(`Không thực hiện được (${res.status}): ${out.error ?? "lỗi không rõ"}`);
  const who = target.display_name ?? id;
  return {
    suspend: `Đã khoá tài khoản ${who} và đăng xuất mọi phiên.`,
    unsuspend: `Đã mở khoá tài khoản ${who}.`,
    signout: `Đã đăng xuất mọi phiên của ${who}.`,
    grant_platform_admin: `Đã cấp quyền admin hệ thống cho ${who}.`,
    revoke_platform_admin: `Đã thu quyền admin hệ thống của ${who}.`,
    delete: `Đã XOÁ tài khoản ${who} (không hoàn tác).`,
  }[action]!;
}

// ─── Dòng họ ─────────────────────────────────────────────────────────────

export async function listClans(c: AdminCtx, a: Args): Promise<string> {
  const limit = clampInt(a.limit, 30, 1, 100);
  const offset = Math.max(Number.isInteger(a.offset) ? (a.offset as number) : 0, 0);
  let q = c.db.from("clans").select("id, name, visibility, person_count, max_persons, max_users, owner_id, created_at, updated_at", { count: "exact" });
  if (typeof a.q === "string" && a.q.trim()) q = q.ilike("name", `%${a.q.trim().replace(/[%_,()]/g, " ")}%`);
  const sort = String(a.sort ?? "newest");
  q = sort === "name" ? q.order("name") : sort === "members" ? q.order("person_count", { ascending: false }) : sort === "updated" ? q.order("updated_at", { ascending: false }) : q.order("created_at", { ascending: false });
  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Không có dòng họ nào khớp.";
  const lines = data.map((r) => `${r.id} · ${r.name} · ${r.person_count} người (tối đa ${r.max_persons}, ${r.max_users} tài khoản) · ${r.visibility === "public" ? "công khai" : "riêng tư"} · tạo ${day(r.created_at)} · cập nhật ${day(r.updated_at)}`);
  const more = (count ?? 0) > offset + data.length ? `\n… còn ${(count ?? 0) - offset - data.length} dòng họ (offset=${offset + data.length}).` : "";
  return `Tổng ${count ?? data.length} dòng họ, hiện ${offset + 1}–${offset + data.length}:\n${lines.join("\n")}${more}`;
}

export async function setClanLimits(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.clan_id, "clan_id");
  const patch: Record<string, number> = {};
  for (const k of ["max_persons", "max_users"] as const) {
    if (a[k] === undefined) continue;
    if (!Number.isInteger(a[k]) || (a[k] as number) < 1) throw new UserError(`${k} phải là số nguyên ≥ 1.`);
    patch[k] = a[k] as number;
  }
  if (!Object.keys(patch).length) throw new UserError("Truyền max_persons và/hoặc max_users.");
  const { data, error } = await c.db.from("clans").update(patch).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? `Đã cập nhật giới hạn: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}.` : "Không tìm thấy dòng họ.";
}

// ─── Đóng góp (duyệt) ───────────────────────────────────────────────────

export async function listContributions(c: AdminCtx, a: Args): Promise<string> {
  const limit = clampInt(a.limit, 20, 1, 50);
  const status = typeof a.status === "string" ? a.status : "pending";
  if (!["pending", "approved", "rejected", "needs_info"].includes(status)) throw new UserError("status không hợp lệ.");
  let q = c.db.from("contributions").select("id, clan_id, person_id, contribution_type, proposed_data, submitter_name, submitter_relation, submitter_note, status, review_note, created_at").eq("status", status);
  if (a.clan_id !== undefined) q = q.eq("clan_id", uuid(a.clan_id, "clan_id"));
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  if (!data?.length) return `Không có đóng góp nào ở trạng thái ${status}.`;
  const clanIds = [...new Set(data.map((r) => r.clan_id as string))];
  const { data: clans } = await c.db.from("clans").select("id, name").in("id", clanIds);
  const names = new Map((clans ?? []).map((x) => [x.id as string, x.name as string]));
  return data
    .map(
      (r) =>
        `${r.id} · [${names.get(r.clan_id as string) ?? r.clan_id}] ${r.contribution_type}${r.person_id ? ` · người ${r.person_id}` : ""} · gửi bởi ${r.submitter_name ?? "?"} (${r.submitter_relation ?? "?"}) ${day(r.created_at)}\n   đề xuất: ${JSON.stringify(r.proposed_data).slice(0, 400)}${r.submitter_note ? `\n   ghi chú: ${String(r.submitter_note).slice(0, 200)}` : ""}`,
    )
    .join("\n");
}

export async function reviewContribution(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.contribution_id, "contribution_id");
  const note = a.note === undefined ? null : optStr(a.note, "note", 1000);
  if (a.decision === "approve") {
    const { error } = await c.db.rpc("apply_contribution", { p_id: id });
    if (error) throw new UserError(error.message);
    return "Đã DUYỆT và áp dụng đóng góp vào gia phả.";
  }
  if (a.decision === "reject" || a.decision === "needs_info") {
    const { error } = await c.db.rpc("reject_contribution", { p_id: id, p_status: a.decision === "reject" ? "rejected" : "needs_info", p_note: note });
    if (error) throw new UserError(error.message);
    return a.decision === "reject" ? "Đã từ chối đóng góp." : "Đã yêu cầu bổ sung thông tin cho đóng góp.";
  }
  throw new UserError("decision phải là approve, reject hoặc needs_info.");
}

// ─── Góp ý ───────────────────────────────────────────────────────────────

export async function listFeedback(c: AdminCtx, a: Args): Promise<string> {
  const limit = clampInt(a.limit, 30, 1, 100);
  let q = c.db.from("feedback").select("id, clan_id, message, category, status, contact, page_path, app_version, admin_note, admin_reply, created_at");
  if (typeof a.status === "string") q = q.eq("status", a.status);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Không có góp ý nào.";
  return data
    .map((f) => `${f.id} · ${f.status} · ${f.category} · ${day(f.created_at)}${f.contact ? ` · liên hệ: ${f.contact}` : ""}${f.page_path ? ` · trang: ${f.page_path}` : ""}\n   ${String(f.message).slice(0, 400)}${f.admin_note ? `\n   ghi chú nội bộ: ${String(f.admin_note).slice(0, 200)}` : ""}${f.admin_reply ? `\n   đã trả lời: ${String(f.admin_reply).slice(0, 200)}` : ""}`)
    .join("\n");
}

export async function updateFeedback(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.feedback_id, "feedback_id");
  const patch: Record<string, unknown> = {};
  if (a.status !== undefined) {
    if (!["new", "seen", "resolved", "spam"].includes(a.status as string)) throw new UserError("status không hợp lệ.");
    patch.status = a.status;
    // Khớp updateFeedback của app: đóng góp ý thì ghi người/giờ xử lý, mở lại thì xoá.
    patch.resolved_at = a.status === "resolved" ? new Date().toISOString() : null;
    patch.resolved_by = a.status === "resolved" ? c.userId : null;
  }
  if (a.category !== undefined) {
    if (!["bug", "idea", "question", "other"].includes(a.category as string)) throw new UserError("category không hợp lệ.");
    patch.category = a.category;
  }
  if (a.admin_note !== undefined) patch.admin_note = optStr(a.admin_note, "admin_note", 5000);
  if (a.admin_reply !== undefined) {
    patch.admin_reply = optStr(a.admin_reply, "admin_reply", 5000);
    patch.replied_at = patch.admin_reply ? new Date().toISOString() : null;
  }
  if (!Object.keys(patch).length) throw new UserError("Không có trường nào để cập nhật.");
  const { data, error } = await c.db.from("feedback").update(patch).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã cập nhật góp ý." : "Không tìm thấy góp ý.";
}

// ─── Thông báo (announcements) ───────────────────────────────────────────

const LEVELS = ["info", "update", "warning", "critical"];

export async function listAnnouncements(c: AdminCtx): Promise<string> {
  const { data, error } = await c.db.from("announcements").select("id, title, level, is_public, published_at, expires_at, body").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Chưa có thông báo nào.";
  return data.map((r) => `${r.id} · ${r.title} · ${r.level}${r.is_public ? " · công khai" : ""} · ${r.published_at ? `đăng ${day(r.published_at)}` : "NHÁP"}${r.expires_at ? ` · hết hạn ${day(r.expires_at)}` : ""}\n   ${String(r.body).slice(0, 200)}`).join("\n");
}

function announcementPatch(a: Args, creating: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.title !== undefined) {
    const t = optStr(a.title, "title", 200);
    if (!t) throw new UserError("title không được để trống.");
    out.title = t;
  } else if (creating) throw new UserError("title là bắt buộc.");
  if (a.body !== undefined) {
    const t = optStr(a.body, "body", 20000);
    if (!t) throw new UserError("body không được để trống.");
    out.body = t;
  } else if (creating) throw new UserError("body là bắt buộc.");
  if (a.level !== undefined) {
    if (!LEVELS.includes(a.level as string)) throw new UserError(`level phải là: ${LEVELS.join(", ")}.`);
    out.level = a.level;
  }
  if (a.is_public !== undefined) {
    if (typeof a.is_public !== "boolean") throw new UserError("is_public phải là true/false.");
    out.is_public = a.is_public;
  }
  if (a.published_at !== undefined) out.published_at = isoOrNull(a.published_at, "published_at");
  if (a.expires_at !== undefined) out.expires_at = isoOrNull(a.expires_at, "expires_at");
  if (!Object.keys(out).length) throw new UserError("Không có trường nào để ghi.");
  return out;
}

export async function createAnnouncement(c: AdminCtx, a: Args): Promise<string> {
  const patch = announcementPatch(a, true);
  const { data, error } = await c.db.from("announcements").insert({ level: "info", is_public: false, published_at: null, expires_at: null, ...patch, created_by: c.userId }).select("id").single();
  if (error) throw new UserError(error.message);
  return `Đã tạo thông báo "${patch.title}" (id ${data.id})${patch.published_at ? "" : " ở dạng nháp"}.`;
}

export async function updateAnnouncement(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.announcement_id, "announcement_id");
  const { announcement_id: _i, ...rest } = a;
  const { data, error } = await c.db.from("announcements").update(announcementPatch(rest, false)).eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã cập nhật thông báo." : "Không tìm thấy thông báo.";
}

export async function deleteAnnouncement(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.announcement_id, "announcement_id");
  requireConfirm(a);
  const { data, error } = await c.db.from("announcements").delete().eq("id", id).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã xoá thông báo." : "Không tìm thấy thông báo.";
}

// ─── Cấu hình nền tảng ───────────────────────────────────────────────────

export async function getSettings(c: AdminCtx, a: Args): Promise<string> {
  if (typeof a.key === "string" && a.key) {
    const { data, error } = await c.db.from("platform_settings").select("key, value, updated_at").eq("key", a.key).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? JSON.stringify(data, null, 2) : `Chưa có cấu hình "${a.key}".`;
  }
  const { data, error } = await c.db.from("platform_settings").select("key, value, updated_at").order("key");
  if (error) throw new Error(error.message);
  if (!data?.length) return "Chưa có cấu hình nào.";
  return data.map((r) => `${r.key} = ${r.value === null ? "(trống)" : String(r.value).length > 160 ? `${String(r.value).slice(0, 160)}…` : r.value}`).join("\n");
}

export async function setSetting(c: AdminCtx, a: Args): Promise<string> {
  requireConfirm(a);
  const key = typeof a.key === "string" ? a.key.trim() : "";
  if (!/^[a-z0-9_.-]{1,100}$/i.test(key)) throw new UserError("key không hợp lệ (chữ, số, _ . -; tối đa 100).");
  const value = a.value === null ? null : typeof a.value === "string" && a.value.length <= 20000 ? a.value : undefined;
  if (value === undefined) throw new UserError("value phải là chuỗi (≤ 20000 ký tự) hoặc null.");
  const { error } = await c.db.from("platform_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new UserError(error.message);
  return `Đã đặt ${key}.`;
}

// ─── Token MCP ───────────────────────────────────────────────────────────

export async function listApiTokens(c: AdminCtx): Promise<string> {
  const { data, error } = await c.db.from("api_tokens").select("id, clan_id, user_id, name, token_prefix, scope, expires_at, last_used_at, revoked_at, created_at").order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Chưa có token nào.";
  const clanIds = [...new Set(data.map((t) => t.clan_id).filter(Boolean) as string[])];
  const userIds = [...new Set(data.map((t) => t.user_id as string))];
  const [{ data: clans }, { data: users }] = await Promise.all([
    clanIds.length ? c.db.from("clans").select("id, name").in("id", clanIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    c.db.from("profiles").select("id, display_name").in("id", userIds),
  ]);
  const cn = new Map((clans ?? []).map((x) => [x.id, x.name]));
  const un = new Map((users ?? []).map((x) => [x.id, x.display_name]));
  return data
    .map((t) => {
      const state = t.revoked_at ? "đã thu hồi" : new Date(t.expires_at as string) < new Date() ? "hết hạn" : "đang dùng";
      return `${t.id} · ${t.name} (${t.token_prefix}…) · ${t.scope} · ${t.clan_id ? cn.get(t.clan_id as string) ?? t.clan_id : "TOÀN NỀN TẢNG"} · chủ: ${un.get(t.user_id as string) ?? t.user_id} · ${state} · hết hạn ${day(t.expires_at)} · dùng gần nhất ${day(t.last_used_at)}`;
    })
    .join("\n");
}

export async function revokeApiToken(c: AdminCtx, a: Args): Promise<string> {
  const id = uuid(a.token_id, "token_id");
  requireConfirm(a);
  if (id === c.tokenId) throw new UserError("Không thu hồi chính token đang dùng — hãy thu hồi trong app.");
  const { data, error } = await c.db.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null).select("id");
  if (error) throw new UserError(error.message);
  return data?.length ? "Đã thu hồi token." : "Không tìm thấy token, hoặc token đã bị thu hồi.";
}

export async function auditLog(c: AdminCtx, a: Args): Promise<string> {
  const limit = clampInt(a.limit, 30, 1, 100);
  let q = c.db.from("mcp_admin_log").select("at, tool, clan_id, args, is_error, result").order("at", { ascending: false }).limit(limit);
  if (typeof a.tool === "string" && a.tool) q = q.eq("tool", a.tool);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (!data?.length) return "Chưa có lệnh nào được ghi.";
  return data.map((r) => `${String(r.at).slice(0, 19).replace("T", " ")} · ${r.tool}${r.clan_id ? ` · clan ${String(r.clan_id).slice(0, 8)}` : ""} · ${r.is_error ? "LỖI" : "ok"} · ${JSON.stringify(r.args ?? {}).slice(0, 200)}${r.result ? ` → ${String(r.result).slice(0, 120)}` : ""}`).join("\n");
}

export const ADMIN_OPS: Record<string, (c: AdminCtx, a: Args) => Promise<string>> = {
  admin_platform_stats: (c) => platformStats(c),
  admin_list_users: listUsers,
  admin_set_user_limits: setUserLimits,
  admin_user_action: userAction,
  admin_list_clans: listClans,
  admin_set_clan_limits: setClanLimits,
  admin_list_contributions: listContributions,
  admin_review_contribution: reviewContribution,
  admin_list_feedback: listFeedback,
  admin_update_feedback: updateFeedback,
  admin_list_announcements: (c) => listAnnouncements(c),
  admin_create_announcement: createAnnouncement,
  admin_update_announcement: updateAnnouncement,
  admin_delete_announcement: deleteAnnouncement,
  admin_get_settings: getSettings,
  admin_set_setting: setSetting,
  admin_list_failed_notifications: (c) => listFailedNotifications(c),
  admin_clear_failed_notification: clearFailedNotification,
  admin_list_api_tokens: (c) => listApiTokens(c),
  admin_revoke_api_token: revokeApiToken,
  admin_audit_log: auditLog,
};
