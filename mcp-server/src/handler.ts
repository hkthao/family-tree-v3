/**
 * mcp-server — máy chủ MCP (Model Context Protocol) để AI bên ngoài tra cứu và ĐỀ XUẤT chỉnh
 * sửa gia phả: Claude Desktop / Claude Code / ChatGPT / bất kỳ client MCP nào.
 *
 * POST /mcp   Authorization: Bearer gpt_…   (JSON-RPC 2.0, "Streamable HTTP"
 * không trạng thái: mỗi POST một phản hồi JSON, không SSE, không session).
 *
 * Ranh giới an toàn:
 *  - Token băm SHA-256 trong `api_tokens`, gắn 1 người + 1 dòng họ, có hạn, thu hồi được.
 *    Chỉ admin dòng họ / admin hệ thống tạo được.
 *  - Mỗi lượt gọi kiểm lại: token còn hiệu lực, chủ token chưa bị khoá và vẫn còn quyền.
 *  - Mọi truy vấn dữ liệu chạy bằng JWT NGẮN HẠN của chính chủ token (ký bằng JWT_SECRET,
 *    sống 2 phút) → RLS, trigger audit, quyền xoá y như người đó tự thao tác trong app.
 *    Service role CHỈ dùng để tra token/vai trò. Vẫn lọc clan_id ở mọi truy vấn vì token
 *    bị khoá vào đúng một dòng họ (admin hệ thống thì RLS không tự giới hạn).
 *  - Gói quyền: read · propose (chỉ gửi vào hàng chờ `contributions`) · write (ghi thẳng).
 *    Quyền thật = min(gói, vai trò hiện tại): bị hạ vai trò thì token hạ theo.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CORS, json } from "../../supabase/functions/_shared/cors.ts";
import { admin, sha256Hex } from "./db.ts";
import { challenge, resolveAccessToken } from "./oauth.ts";
import { runTool } from "./tools.ts";
import { UserError } from "./fields.ts";
import { OPS } from "./ops.ts";
import { MAX_NAME, UUID_RE, validateChanges, validateNewPerson, validateNote } from "./proposals.ts";
import { ADMIN_OPS, type AdminCtx } from "./admin.ts";
import { MCP_TOOLS, scopeAllows, toolsForScope, type Scope } from "./specs.ts";

const env = (k: string): string | undefined => process.env[k];

const SUPABASE_URL = env("SUPABASE_URL")!;
const ANON_KEY = env("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET =
  env("JWT_SECRET") ?? "";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "dong-ho-viet", version: "3.0.0" };

const TOKEN_RE = /^gpt_[A-Za-z0-9_-]{32,96}$/;
/** Access token OAuth (cấp qua /oauth/token). */
const OAUTH_TOKEN_RE = /^gat_[A-Za-z0-9_-]{32,96}$/;

/** Trần chống vòng lặp: 120 lệnh/phút/token (bộ nhớ tiến trình; một server nên đếm chính xác — đủ để chặn script chạy bậy). */
const RATE_PER_MIN = 120;
/** Trần đề xuất đang chờ của một người — tránh đổ đầy hàng chờ của admin. */
const MAX_PENDING_PER_USER = 30;
const hits = new Map<string, number[]>();

export { admin };

const b64url = (b: ArrayBuffer | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** JWT HS256 sống 2 phút cho đúng một người dùng — để RLS nhìn thấy auth.uid() của họ. */
async function mintUserJwt(userId: string): Promise<string> {
  if (!JWT_SECRET) throw new Error("Máy chủ thiếu JWT_SECRET nên không thể chạy thay mặt người dùng.");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ aud: "authenticated", role: "authenticated", sub: userId, iat: now, exp: now + 120, app_metadata: { via: "mcp" } }),
  );
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

interface Auth {
  tokenId: string;
  userId: string;
  clanId: string;
  scope: Scope;
  tokenName: string;
  /** JWT ngắn hạn mới của chủ token — chỉ dùng để gọi edge function (admin-action). */
  mintJwt: () => Promise<string>;
  /** Client mang danh tính chủ token — mọi dữ liệu gia phả đi qua đây (RLS áp dụng). */
  db: SupabaseClient;
  /** Client mới với JWT mới, cho thao tác chạy quá vài chục giây. */
  fresh: () => Promise<SupabaseClient>;
}

function rateLimited(tokenId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(tokenId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(tokenId, recent);
  return recent.length > RATE_PER_MIN;
}

async function authenticate(req: Request): Promise<Auth | Response> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  const token = m?.[1] ?? "";
  const isOAuth = OAUTH_TOKEN_RE.test(token);
  if (!isOAuth && !TOKEN_RE.test(token)) {
    return unauthorized("Thiếu hoặc sai token. Kết nối bằng OAuth, hoặc tạo token trong app: Cài đặt dòng họ → Kết nối AI.", req);
  }

  // Token OAuth: tra ra "kết nối" (hàng api_tokens) rồi kiểm y như token thường (thu hồi, hạn, thành viên, khoá).
  const grantId = isOAuth ? await resolveAccessToken(token) : null;
  if (isOAuth && !grantId) return unauthorized("Phiên kết nối hết hạn hoặc đã bị thu hồi.", req);
  const q = admin.from("api_tokens").select("id, user_id, clan_id, scope, name, expires_at, revoked_at");
  const { data: row } = await (grantId ? q.eq("id", grantId) : q.eq("token_hash", await sha256Hex(token))).maybeSingle();
  if (!row || row.revoked_at || new Date(row.expires_at as string) < new Date()) {
    return unauthorized("Token không còn hiệu lực (đã thu hồi hoặc hết hạn).", req);
  }

  const isAdminToken = row.scope === "admin";
  const [{ data: member }, { data: profile }] = await Promise.all([
    isAdminToken
      ? Promise.resolve({ data: null })
      : admin.from("clan_members").select("role").eq("clan_id", row.clan_id).eq("user_id", row.user_id).maybeSingle(),
    admin.from("profiles").select("is_suspended, is_platform_admin").eq("id", row.user_id).maybeSingle(),
  ]);
  const sysAdmin = !!profile?.is_platform_admin;
  if (profile?.is_suspended) return unauthorized("Tài khoản của người tạo token đang bị khoá.", req);
  // Token admin: sống chừng nào chủ token CÒN là admin hệ thống — bị gỡ quyền là chết ngay ở lượt gọi kế tiếp.
  if (isAdminToken && !sysAdmin) return unauthorized("Người tạo token không còn là admin hệ thống.", req);
  // Admin hệ thống không cần là thành viên (token do họ tạo cho dòng họ bất kỳ).
  if (!isAdminToken && !member && !sysAdmin) return unauthorized("Người tạo token không còn là thành viên dòng họ.", req);
  // Quyền thật = min(gói, vai trò hiện tại). Ghi thẳng cần là editor/admin (hoặc admin hệ
  // thống); người đã bị hạ xuống viewer chỉ còn đọc. RLS vẫn là lớp chặn cuối cùng.
  const canEdit = sysAdmin || member?.role === "admin" || member?.role === "editor";
  const stored = row.scope as Scope;
  const scope: Scope = isAdminToken ? "admin" : stored !== "read" && !canEdit ? "read" : stored;

  const fresh = async (): Promise<SupabaseClient> =>
    createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${await mintUserJwt(row.user_id as string)}` } },
    });
  let db: SupabaseClient;
  try {
    db = await fresh();
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }

  // Ghi mốc dùng gần nhất; lỗi ở đây không được chặn lượt gọi.
  void admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

  return {
    tokenId: row.id as string,
    userId: row.user_id as string,
    clanId: (row.clan_id as string | null) ?? "", // token admin không gắn dòng họ: mỗi lệnh tự truyền clan_id
    scope,
    tokenName: row.name as string,
    db,
    fresh,
    mintJwt: () => mintUserJwt(row.user_id as string),
  };
}

function unauthorized(message: string, req: Request): Response {
  // resource_metadata chỉ cho client MCP biết đường khám phá OAuth (RFC 9728).
  return json({ error: message }, { status: 401, headers: { "WWW-Authenticate": challenge(req) } });
}

// ─── Tool đọc bổ sung ──────────────────────────────────────────────────────────────

const PERSON_DETAIL_COLS =
  "id, full_name, courtesy_name, posthumous_name, nickname, gender, is_living, generation, " +
  "birth_date, birth_date_precision, death_date, death_date_precision, birth_place, burial_place, bio, " +
  "birth_lunar_year, birth_lunar_month, birth_lunar_day, birth_lunar_is_leap, " +
  "death_lunar_year, death_lunar_month, death_lunar_day, death_lunar_is_leap, " +
  "death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap, " +
  "birth_order, lifespan_years, branch_id, photo_path, birth_family_id";

async function getPersonDetail(a: Auth, id: string): Promise<string> {
  if (!UUID_RE.test(id)) return "person_id không hợp lệ — lấy id từ search_person.";
  const { data: p, error } = await a.db
    .from("persons")
    .select(PERSON_DETAIL_COLS)
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return "Không tìm thấy người này.";
  const rec = p as unknown as Record<string, unknown>;
  const { birth_family_id: _omit, photo_path, ...rest } = rec;
  if (photo_path) (rest as Record<string, unknown>).has_photo = true;
  return JSON.stringify(
    Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== "")),
    null,
    2,
  );
}

async function getRelatives(a: Auth, id: string): Promise<string> {
  if (!UUID_RE.test(id)) return "person_id không hợp lệ — lấy id từ search_person.";
  const { data: me } = await a.db
    .from("persons")
    .select("id, full_name, birth_family_id")
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!me) return "Không tìm thấy người này.";

  const [parentFam, ownFams] = await Promise.all([
    me.birth_family_id
      ? a.db.from("families").select("husband_id, wife_id").eq("clan_id", a.clanId).eq("id", me.birth_family_id).maybeSingle()
      : Promise.resolve({ data: null }),
    a.db
      .from("families")
      .select("id, husband_id, wife_id")
      .eq("clan_id", a.clanId)
      .or(`husband_id.eq.${id},wife_id.eq.${id}`)
      .is("deleted_at", null),
  ]);

  const famIds = (ownFams.data ?? []).map((f) => f.id as string);
  const spouseIds = (ownFams.data ?? [])
    .map((f) => (f.husband_id === id ? f.wife_id : f.husband_id) as string | null)
    .filter((x): x is string => !!x);
  const parentIds = [parentFam.data?.husband_id, parentFam.data?.wife_id].filter((x): x is string => !!x);

  const { data: kids } = famIds.length
    ? await a.db
        .from("persons")
        .select("id, full_name, gender, birth_date")
        .eq("clan_id", a.clanId)
        .in("birth_family_id", famIds)
        .is("deleted_at", null)
        .order("birth_date", { ascending: true, nullsFirst: false })
        .limit(100)
    : { data: [] };

  const ids = [...new Set([...parentIds, ...spouseIds])];
  const { data: others } = ids.length
    ? await a.db.from("persons").select("id, full_name, gender, birth_date").eq("clan_id", a.clanId).in("id", ids).is("deleted_at", null)
    : { data: [] };
  const byId = new Map((others ?? []).map((p) => [p.id as string, p]));
  const fmt = (p: { id: unknown; full_name: unknown; birth_date?: unknown }) =>
    `${p.id} · ${p.full_name}${p.birth_date ? ` (sinh ${String(p.birth_date).slice(0, 4)})` : ""}`;
  const list = (title: string, rows: Array<{ id: unknown; full_name: unknown; birth_date?: unknown }>) =>
    `${title}: ${rows.length ? "\n" + rows.map((r) => "  " + fmt(r)).join("\n") : "(không có)"}`;

  return [
    `${me.full_name}`,
    list("Cha mẹ", parentIds.map((x) => byId.get(x)).filter((x) => !!x) as never[]),
    list("Vợ/chồng", spouseIds.map((x) => byId.get(x)).filter((x) => !!x) as never[]),
    list("Con", (kids ?? []) as never[]),
  ].join("\n");
}

// ─── Tool đề xuất ──────────────────────────────────────────────────────────────

async function personInClan(a: Auth, id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return false;
  const { data } = await a.db
    .from("persons")
    .select("id")
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return !!data;
}

async function submitProposal(
  a: Auth,
  type: "add_person" | "edit_person" | "add_note",
  personId: string | null,
  proposed: unknown,
  reason: unknown,
): Promise<string> {
  const { count } = await a.db
    .from("contributions")
    .select("id", { count: "exact", head: true })
    .eq("submitter_user_id", a.userId)
    .eq("clan_id", a.clanId)
    .eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING_PER_USER) {
    return `Đã có ${count} đề xuất đang chờ duyệt. Hãy chờ admin xử lý bớt rồi gửi tiếp.`;
  }
  const { data: profile } = await a.db.from("profiles").select("display_name").eq("id", a.userId).maybeSingle();
  const who = String(profile?.display_name ?? "Thành viên").slice(0, MAX_NAME);
  const note = (typeof reason === "string" && reason.trim() ? reason.trim() : "").slice(0, 1000);

  const { data, error } = await a.db
    .from("contributions")
    .insert({
      clan_id: a.clanId,
      person_id: personId,
      contribution_type: type,
      proposed_data: proposed,
      submitter_user_id: a.userId,
      submitter_name: who,
      submitter_relation: "Gửi qua AI",
      submitter_note: `[AI · token "${a.tokenName}"] ${note}`.trim(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Báo admin qua email như đóng góp thường; lỗi gửi thư không làm hỏng đề xuất.
  fetch(`${SUPABASE_URL}/functions/v1/notify-contribution`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ contribution_id: data.id }),
  }).catch(() => {});

  return `Đã gửi đề xuất (id ${data.id}) vào hàng chờ duyệt. CHƯA có gì được ghi vào gia phả — admin phải duyệt trong app (mục Đóng góp). Dùng list_my_proposals để xem trạng thái.`;
}

async function listProposals(a: Auth, status: unknown): Promise<string> {
  let q = a.db
    .from("contributions")
    .select("id, contribution_type, person_id, status, review_note, created_at")
    .eq("clan_id", a.clanId)
    .eq("submitter_user_id", a.userId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (typeof status === "string") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (!data?.length) return "Chưa có đề xuất nào.";
  return data
    .map((c) => `${c.id} · ${c.contribution_type} · ${c.status} · ${String(c.created_at).slice(0, 10)}${c.review_note ? ` · ghi chú: ${c.review_note}` : ""}`)
    .join("\n");
}

// ─── Điều phối ───────────────────────────────────────────────────────────────

/** Bỏ dữ liệu to / nhạy khỏi tham số trước khi ghi nhật ký. */
function logArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === "image_base64") out[k] = `[base64 ${String(v).length} ký tự]`;
    else out[k] = typeof v === "string" && v.length > 500 ? `${v.slice(0, 500)}…` : v;
  }
  return out;
}

/** Token admin: tool quản trị hệ thống, hoặc tool theo dòng họ kèm `clan_id`. Mọi lệnh đều được ghi `mcp_admin_log`. */
async function callAdminTool(a: Auth, name: string, args: Record<string, unknown>): Promise<{ text: string; isError?: boolean }> {
  let res: { text: string; isError?: boolean };
  let clanId: string | null = null;
  try {
    const adminOp = ADMIN_OPS[name];
    if (adminOp) {
      const ctx: AdminCtx = { db: a.db, userId: a.userId, tokenId: a.tokenId, mintJwt: a.mintJwt, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY };
      res = { text: await adminOp(ctx, args) };
      if (typeof args.clan_id === "string" && UUID_RE.test(args.clan_id)) clanId = args.clan_id;
    } else {
      const spec = MCP_TOOLS.find((t) => t.name === name);
      if (!spec) res = { text: `Không có công cụ "${name}".`, isError: true };
      else if (spec.needs === "propose") res = { text: "Token admin ghi thẳng: dùng tool ghi (create_person, update_person…), không dùng propose_*.", isError: true };
      else {
        const { clan_id, ...rest } = args;
        if (typeof clan_id !== "string" || !UUID_RE.test(clan_id)) res = { text: "Cần clan_id (UUID) — lấy từ admin_list_clans.", isError: true };
        else {
          const { data: clan } = await a.db.from("clans").select("id").eq("id", clan_id).maybeSingle();
          if (!clan) res = { text: "Không tìm thấy dòng họ này.", isError: true };
          else {
            clanId = clan_id;
            // Các tool theo dòng họ chạy như gói "write" trên dòng họ vừa chọn (đọc + ghi thẳng).
            res = await callTool({ ...a, scope: "write", clanId: clan_id }, name, rest);
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof UserError) res = { text: e.message, isError: true };
    else {
      console.error("[mcp-server] admin tool", name, e);
      res = { text: `Lỗi hệ thống: ${(e as Error).message}`, isError: true };
    }
  }
  if (name !== "admin_audit_log") {
    void admin
      .from("mcp_admin_log")
      .insert({ user_id: a.userId, token_id: a.tokenId, clan_id: clanId, tool: name, args: logArgs(args), is_error: !!res.isError, result: res.text.slice(0, 300) })
      .then(({ error }) => error && console.error("[mcp-server] không ghi được mcp_admin_log:", error.message));
  }
  return res;
}

async function callTool(a: Auth, name: string, args: Record<string, unknown>): Promise<{ text: string; isError?: boolean }> {
  if (a.scope === "admin") return callAdminTool(a, name, args);
  const spec = MCP_TOOLS.find((t) => t.name === name);
  if (!spec) return { text: `Không có công cụ "${name}".`, isError: true };
  if (!scopeAllows(a.scope, spec.needs)) {
    return {
      text: `Công cụ này cần token gói "${spec.needs === "write" ? "ghi" : "đề xuất"}". Token hiện tại: "${a.scope}" (gói bị hạ xuống đọc nếu chủ token không còn là biên tập viên/admin).`,
      isError: true,
    };
  }
  try {
    const ctx = { sb: a.db as never, clanId: a.clanId };
    const op = OPS[name];
    if (op) return { text: await op({ db: a.db, clanId: a.clanId, userId: a.userId, fresh: a.fresh }, args) };
    switch (name) {
      case "get_person":
        return { text: await getPersonDetail(a, String(args.person_id ?? "")) };
      case "get_relatives":
        return { text: await getRelatives(a, String(args.person_id ?? "")) };
      case "list_my_proposals":
        return { text: await listProposals(a, args.status) };
      case "propose_add_person": {
        const v = validateNewPerson(args);
        if (!v.ok) return { text: v.error, isError: true };
        const rel = v.value.relation as { of_person_id: string } | undefined;
        if (rel && !(await personInClan(a, rel.of_person_id))) {
          return { text: "relation_of_person_id không thuộc dòng họ này.", isError: true };
        }
        return { text: await submitProposal(a, "add_person", null, v.value, args.reason) };
      }
      case "propose_edit_person": {
        if (!(await personInClan(a, args.person_id))) return { text: "person_id không thuộc dòng họ này.", isError: true };
        const v = validateChanges(args.changes);
        if (!v.ok) return { text: v.error, isError: true };
        return { text: await submitProposal(a, "edit_person", args.person_id as string, { changes: v.value }, args.reason) };
      }
      case "propose_add_note": {
        if (!(await personInClan(a, args.person_id))) return { text: "person_id không thuộc dòng họ này.", isError: true };
        const v = validateNote(args.note);
        if (!v.ok) return { text: v.error, isError: true };
        return { text: await submitProposal(a, "add_note", args.person_id as string, { note_addition: v.value }, args.reason) };
      }
      // search_person, get_kinship, upcoming_anniversaries, search_book, clan_stats:
      // dùng lại đúng bộ tool của trợ lý trong app (cùng logic xưng hô, âm lịch).
      default:
        return { text: await runTool(ctx, name, args) };
    }
  } catch (e) {
    if (e instanceof UserError) return { text: e.message, isError: true };
    console.error("[mcp-server] tool", name, e);
    return { text: `Lỗi hệ thống: ${(e as Error).message}`, isError: true };
  }
}

interface RpcReq {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

async function handle(a: Auth, r: RpcReq): Promise<unknown | null> {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: r.id, result });
  const bad = (code: number, message: string) => ({ jsonrpc: "2.0", id: r.id ?? null, error: { code, message } });

  // Notification (không có id): không phản hồi.
  if (r.id === undefined || r.id === null) return null;

  switch (r.method) {
    case "initialize": {
      const asked = String(r.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Tra cứu và đề xuất chỉnh sửa gia phả một dòng họ Việt. Luôn gọi search_person để lấy id trước. " +
          "Token admin: mọi tool theo dòng họ cần clan_id (admin_list_clans). Xưng hô dùng get_kinship, ngày giỗ dùng upcoming_anniversaries — đừng tự suy luận. " +
          "Công cụ propose_* chỉ gửi đề xuất chờ admin duyệt, không ghi trực tiếp.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: toolsForScope(a.scope).map(({ needs: _n, ...t }) => t),
      });
    case "tools/call": {
      const name = String(r.params?.name ?? "");
      const args = (r.params?.arguments ?? {}) as Record<string, unknown>;
      const res = await callTool(a, name, args);
      return ok({ content: [{ type: "text", text: res.text }], isError: !!res.isError });
    }
    default:
      return bad(-32601, `Không hỗ trợ method "${r.method}".`);
  }
}

export async function handleHttp(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...CORS, "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id" },
    });
  }
  // Không có luồng server→client (SSE); client MCP chấp nhận 405 cho GET.
  if (req.method !== "POST") return json({ error: "Dùng POST." }, { status: 405, headers: { Allow: "POST" } });

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (rateLimited(auth.tokenId)) {
    return json({ error: "Gọi quá nhanh, thử lại sau một phút." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON không hợp lệ." } }, { status: 400 });
  }

  if (Array.isArray(body)) {
    if (body.length > 20) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Tối đa 20 lệnh một lô." } }, { status: 400 });
    const out = (await Promise.all(body.map((r) => handle(auth, r as RpcReq)))).filter((x) => x !== null);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await handle(auth, body as RpcReq);
  return res === null ? new Response(null, { status: 202, headers: CORS }) : json(res);
}