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
import { runTool } from "./tools.ts";
import { MAX_NAME, UUID_RE, validateChanges, validateNewPerson, validateNote } from "./proposals.ts";
import { MCP_TOOLS, scopeAllows, type Scope } from "./specs.ts";

const env = (k: string): string | undefined => process.env[k];

const SUPABASE_URL = env("SUPABASE_URL")!;
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = env("SUPABASE_ANON_KEY")!;
const JWT_SECRET =
  env("JWT_SECRET") ?? "";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "dong-ho-viet", version: "1.0.0" };

const TOKEN_RE = /^gpt_[A-Za-z0-9_-]{32,96}$/;

/** Trần chống vòng lặp: 60 lệnh/phút/token (bộ nhớ tiến trình; một server nên đếm chính xác — đủ để chặn script chạy bậy). */
const RATE_PER_MIN = 60;
/** Trần đề xuất đang chờ của một người — tránh đổ đầy hàng chờ của admin. */
const MAX_PENDING_PER_USER = 30;
const hits = new Map<string, number[]>();

/** Service role: CHỈ để tra token, vai trò, hồ sơ. Không đụng dữ liệu gia phả. */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
  /** Client mang danh tính chủ token — mọi dữ liệu gia phả đi qua đây (RLS áp dụng). */
  db: SupabaseClient;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
  if (!TOKEN_RE.test(token)) return unauthorized("Thiếu hoặc sai token. Tạo token trong app: Cài đặt dòng họ → Kết nối AI.");

  const { data: row } = await admin
    .from("api_tokens")
    .select("id, user_id, clan_id, scope, name, expires_at, revoked_at")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!row || row.revoked_at || new Date(row.expires_at as string) < new Date()) {
    return unauthorized("Token không còn hiệu lực (đã thu hồi hoặc hết hạn).");
  }

  const [{ data: member }, { data: profile }] = await Promise.all([
    admin.from("clan_members").select("role").eq("clan_id", row.clan_id).eq("user_id", row.user_id).maybeSingle(),
    admin.from("profiles").select("is_suspended, is_platform_admin").eq("id", row.user_id).maybeSingle(),
  ]);
  // Admin hệ thống không cần là thành viên (token do họ tạo cho dòng họ bất kỳ).
  const sysAdmin = !!profile?.is_platform_admin;
  if ((!member && !sysAdmin) || profile?.is_suspended) {
    return unauthorized("Người tạo token không còn là thành viên dòng họ.");
  }
  // Quyền thật = min(gói, vai trò hiện tại). Ghi thẳng cần là editor/admin (hoặc admin hệ
  // thống); người đã bị hạ xuống viewer chỉ còn đọc. RLS vẫn là lớp chặn cuối cùng.
  const canEdit = sysAdmin || member?.role === "admin" || member?.role === "editor";
  const stored = row.scope as Scope;
  const scope: Scope = stored !== "read" && !canEdit ? "read" : stored;

  let db: SupabaseClient;
  try {
    db = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${await mintUserJwt(row.user_id as string)}` } },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }

  // Ghi mốc dùng gần nhất; lỗi ở đây không được chặn lượt gọi.
  void admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

  return { tokenId: row.id as string, userId: row.user_id as string, clanId: row.clan_id as string, scope, tokenName: row.name as string, db };
}

function unauthorized(message: string): Response {
  return json({ error: message }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
}

// ─── Tool đọc bổ sung ──────────────────────────────────────────────────────────────

const PERSON_DETAIL_COLS =
  "id, full_name, courtesy_name, posthumous_name, nickname, gender, is_living, generation, " +
  "birth_date, death_date, birth_place, burial_place, bio, " +
  "death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap, birth_family_id";

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
  const { birth_family_id: _omit, ...rest } = rec;
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

// ─── Tool ghi thẳng (gói write) ────────────────────────────────────────────────
// Chạy bằng JWT của chủ token: RLS quyết định ai được sửa/xoá gì. Hàng bị RLS chặn trả về
// 0 dòng (không báo lỗi) nên mọi lệnh ghi đều `.select("id")` để biết có thật sự ghi không.

const DENIED = "Không ghi được: không tìm thấy người này, hoặc chủ token không đủ quyền với thao tác này.";

async function createPerson(a: Auth, v: Record<string, unknown>): Promise<string> {
  const rel = v.relation as { as: "child" | "spouse"; of_person_id: string } | undefined;
  const { relation: _r, ...fields } = v;
  const row: Record<string, unknown> = { ...fields, clan_id: a.clanId };

  let relatedGender: string | null = null;
  if (rel) {
    const { data: rp } = await a.db
      .from("persons")
      .select("id, gender")
      .eq("clan_id", a.clanId)
      .eq("id", rel.of_person_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!rp) return "relation_of_person_id không thuộc dòng họ này.";
    relatedGender = rp.gender as string;

    if (rel.as === "child") {
      // Cùng cách apply_contribution/app làm: dùng gia đình đầu tiên của người đó, chưa có thì tạo.
      const { data: fam } = await a.db
        .from("families")
        .select("id")
        .eq("clan_id", a.clanId)
        .or(`husband_id.eq.${rel.of_person_id},wife_id.eq.${rel.of_person_id}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      let famId = fam?.id as string | undefined;
      if (!famId) {
        const { data: nf, error } = await a.db
          .from("families")
          .insert({
            clan_id: a.clanId,
            husband_id: relatedGender === "M" ? rel.of_person_id : null,
            wife_id: relatedGender === "F" ? rel.of_person_id : null,
            union_type: "marriage",
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        famId = nf.id as string;
      }
      row.birth_family_id = famId;
    } else if (relatedGender === row.gender) {
      return "Hai người cùng giới tính — app chưa hỗ trợ ghép vợ/chồng cùng giới.";
    }
  }

  const { data: created, error } = await a.db.from("persons").insert(row).select("id").single();
  if (error) throw new Error(error.message);

  if (rel?.as === "spouse") {
    const newIsMale = row.gender === "M";
    const { error: fe } = await a.db.from("families").insert({
      clan_id: a.clanId,
      husband_id: newIsMale ? created.id : rel.of_person_id,
      wife_id: newIsMale ? rel.of_person_id : created.id,
      union_type: "marriage",
    });
    if (fe) {
      await a.db.from("persons").delete().eq("id", created.id); // trigger → xoá mềm, không để người mồ côi
      throw new Error(fe.message);
    }
  }
  return `Đã thêm ${row.full_name} (id ${created.id}).`;
}

async function updatePerson(a: Auth, id: string, changes: Record<string, unknown>): Promise<string> {
  const { data, error } = await a.db
    .from("persons")
    .update(changes)
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ? `Đã cập nhật ${Object.keys(changes).join(", ")}.` : DENIED;
}

async function appendNote(a: Auth, id: string, note: string): Promise<string> {
  const { data: p } = await a.db
    .from("persons")
    .select("bio")
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) return DENIED;
  const bio = p.bio ? `${p.bio}\n\n${note}` : note;
  return await updatePerson(a, id, { bio });
}

async function deletePerson(a: Auth, id: string): Promise<string> {
  // BẮT BUỘC lọc deleted_at is null: trigger xoá mềm chỉ chặn khi dòng chưa bị xoá; gọi lần
  // hai lên dòng đã xoá mềm sẽ XOÁ CỨNG nó.
  const { data: before } = await a.db
    .from("persons")
    .select("deleted_at")
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .maybeSingle();
  if (!before) return DENIED;
  if (before.deleted_at) return "Người này đã được xoá trước đó.";
  const { error } = await a.db
    .from("persons")
    .delete()
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  // Xoá mềm = trigger huỷ DELETE và UPDATE deleted_at, nên RETURNING luôn rỗng: không dựa vào
  // số dòng trả về mà đọc lại trạng thái. RLS chặn thì dòng vẫn còn nguyên (deleted_at null).
  const { data } = await a.db
    .from("persons")
    .select("deleted_at")
    .eq("clan_id", a.clanId)
    .eq("id", id)
    .maybeSingle();
  return data?.deleted_at
    ? "Đã xoá (xoá mềm — khôi phục được từ nhật ký thay đổi trong app)."
    : DENIED;
}

// ─── Điều phối ───────────────────────────────────────────────────────────────

async function callTool(a: Auth, name: string, args: Record<string, unknown>): Promise<{ text: string; isError?: boolean }> {
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
      case "create_person": {
        const v = validateNewPerson(args);
        if (!v.ok) return { text: v.error, isError: true };
        return { text: await createPerson(a, v.value) };
      }
      case "update_person": {
        if (typeof args.person_id !== "string" || !UUID_RE.test(args.person_id)) return { text: "person_id không hợp lệ.", isError: true };
        const v = validateChanges(args.changes);
        if (!v.ok) return { text: v.error, isError: true };
        return { text: await updatePerson(a, args.person_id, v.value) };
      }
      case "append_person_note": {
        if (typeof args.person_id !== "string" || !UUID_RE.test(args.person_id)) return { text: "person_id không hợp lệ.", isError: true };
        const v = validateNote(args.note);
        if (!v.ok) return { text: v.error, isError: true };
        return { text: await appendNote(a, args.person_id, v.value) };
      }
      case "delete_person": {
        if (typeof args.person_id !== "string" || !UUID_RE.test(args.person_id)) return { text: "person_id không hợp lệ.", isError: true };
        if (args.confirm !== true) return { text: "Cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu xoá rõ ràng.", isError: true };
        return { text: await deletePerson(a, args.person_id) };
      }
      // search_person, get_kinship, upcoming_anniversaries, search_book, clan_stats:
      // dùng lại đúng bộ tool của trợ lý trong app (cùng logic xưng hô, âm lịch).
      default:
        return { text: await runTool(ctx, name, args) };
    }
  } catch (e) {
    return { text: `Lỗi: ${(e as Error).message}`, isError: true };
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
          "Xưng hô dùng get_kinship, ngày giỗ dùng upcoming_anniversaries — đừng tự suy luận. " +
          "Công cụ propose_* chỉ gửi đề xuất chờ admin duyệt, không ghi trực tiếp.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: MCP_TOOLS.filter((t) => scopeAllows(a.scope, t.needs)).map(({ needs: _n, ...t }) => t),
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