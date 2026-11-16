/**
 * OAuth 2.1 cho máy chủ MCP theo đặc tả MCP Authorization (RFC 9728 + RFC 8414 + RFC 7591 + PKCE S256):
 * ChatGPT / Claude tự khám phá, tự đăng ký, rồi chuyển người dùng sang màn hình "Cho phép" trong app.
 *
 *   GET  /.well-known/oauth-protected-resource[/mcp]   tài nguyên + máy chủ cấp quyền
 *   GET  /.well-known/oauth-authorization-server       endpoint, PKCE, kiểu xác thực client
 *   POST /oauth/register     đăng ký client (công khai, bị giới hạn tần suất + trần số lượng)
 *   POST /oauth/token        đổi code → access/refresh token, và làm mới (refresh xoay vòng)
 *   POST /oauth/authorize-info  app hỏi: client + redirect_uri hợp lệ không, tên ứng dụng là gì
 *   POST /oauth/approve      app (kèm JWT đăng nhập của người dùng) xin code sau khi người dùng bấm "Cho phép"
 *
 * Mô hình: một lần cấp quyền = một hàng `api_tokens` (kết nối: người + dòng họ + gói, hạn trượt 90 ngày), thu hồi ở danh sách token.
 * Access token (1 giờ) và refresh token (xoay vòng, phát hiện dùng lại → thu hồi cả kết nối) chỉ lưu băm trong `oauth_tokens`.
 * Client luôn là client công khai (không bí mật) bảo vệ bằng PKCE. Không cấp gói `admin` qua OAuth.
 */

import { timingSafeEqual } from "node:crypto";

import { CORS } from "../../supabase/functions/_shared/cors.ts";
import { admin, randomSecret, sha256Hex } from "./db.ts";

const ACCESS_TTL_S = 3600;
const GRANT_TTL_DAYS = 90;
const CODE_TTL_S = 300;
const MAX_CLIENTS = 5000;
const SCOPES = ["read", "propose", "write"] as const;
export type OAuthScope = (typeof SCOPES)[number];

/** Đường dẫn trang cấp quyền trong app (FE). */
export const AUTHORIZE_PATH = "/ket-noi-ai/cap-quyen";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function reply(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...NO_STORE, ...extra },
  });
}
const oauthError = (error: string, description: string, status = 400) =>
  reply({ error, error_description: description }, status);

// ─── Giới hạn tần suất (bộ nhớ tiến trình, một server) ───────────────────────────
const buckets = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 20_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return recent.length > max;
}
/** nginx nối địa chỉ thật của kết nối vào CUỐI X-Forwarded-For; phần đầu do client tự khai nên không tin. */
function clientIp(req: Request): string {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff.at(-1) ?? "unknown";
}

/** Gốc công khai (https://tên-miền) — cấu hình PUBLIC_ORIGIN, không có thì suy ra từ header nginx. */
export function publicOrigin(req: Request): string {
  const fixed = process.env.PUBLIC_ORIGIN?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
  const proto = req.headers.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Header cho 401 để client MCP biết đi khám phá OAuth ở đâu. */
export function challenge(req: Request): string {
  return `Bearer resource_metadata="${publicOrigin(req)}/.well-known/oauth-protected-resource/mcp"`;
}

// ─── Kiểm tra đầu vào ─────────────────────────────────────────────────────────────
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** redirect_uri: https, hoặc http chỉ cho loopback (Claude Code / ứng dụng máy tính). Không fragment, không user:pass. */
export function validRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 300) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && LOOPBACK.has(u.hostname);
}

export function cleanName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim() : "";
  return (s || "Ứng dụng AI").slice(0, 80);
}

const CHALLENGE_RE = /^[A-Za-z0-9_-]{43,128}$/;
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;

async function pkceMatches(verifier: string, challengeValue: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const got = Buffer.from(btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  const want = Buffer.from(challengeValue);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    const text = await req.text();
    if (text.length > 20_000) return null;
    if (ct.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ─── Metadata ─────────────────────────────────────────────────────────────────────
function resourceMetadata(req: Request): Response {
  const origin = publicOrigin(req);
  return reply(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: [...SCOPES],
      resource_name: "Dòng Họ Việt",
    },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
}

function serverMetadata(req: Request): Response {
  const origin = publicOrigin(req);
  return reply(
    {
      issuer: origin,
      authorization_endpoint: `${origin}${AUTHORIZE_PATH}`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [...SCOPES],
    },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
}

// ─── Đăng ký client (RFC 7591) ────────────────────────────────────────────────────
async function register(req: Request): Promise<Response> {
  if (limited(`reg:${clientIp(req)}`, 10, 3600_000)) return oauthError("invalid_client_metadata", "Đăng ký quá nhiều lần, thử lại sau.", 429);
  const body = await readBody(req);
  if (!body) return oauthError("invalid_client_metadata", "Nội dung không hợp lệ.");
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5 || !uris.every(validRedirectUri)) {
    return oauthError("invalid_redirect_uri", "redirect_uris phải gồm 1–5 địa chỉ https (hoặc http chỉ cho localhost).");
  }
  const method = str(body.token_endpoint_auth_method);
  if (method && method !== "none") return oauthError("invalid_client_metadata", "Chỉ hỗ trợ client công khai (token_endpoint_auth_method = none).");

  const { count } = await admin.from("oauth_clients").select("client_id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_CLIENTS) return oauthError("temporarily_unavailable", "Hệ thống đang đầy lượt đăng ký, thử lại sau.", 503);

  const clientId = randomSecret("cli_").slice(0, 36);
  const name = cleanName(body.client_name);
  const { error } = await admin.from("oauth_clients").insert({ client_id: clientId, client_name: name, redirect_uris: uris });
  if (error) return oauthError("server_error", "Không đăng ký được.", 500);
  return reply(
    {
      client_id: clientId,
      client_name: name,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201,
  );
}

interface ClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}
async function findClient(clientId: string): Promise<ClientRow | null> {
  if (!/^cli_[A-Za-z0-9_-]{8,40}$/.test(clientId)) return null;
  const { data } = await admin.from("oauth_clients").select("client_id, client_name, redirect_uris").eq("client_id", clientId).maybeSingle();
  return (data as ClientRow | null) ?? null;
}

/** Kiểm tham số yêu cầu cấp quyền. Trả lỗi dạng chữ (hiện trên trang cấp quyền, KHÔNG chuyển hướng về client). */
async function checkAuthRequest(b: Record<string, unknown>): Promise<{ client: ClientRow } | { error: string }> {
  const client = await findClient(str(b.client_id));
  if (!client) return { error: "Ứng dụng chưa được đăng ký hoặc đã bị xoá." };
  if (!client.redirect_uris.includes(str(b.redirect_uri))) return { error: "Địa chỉ quay về không khớp với đăng ký của ứng dụng." };
  if (str(b.response_type) !== "code") return { error: "Yêu cầu không hợp lệ (response_type)." };
  if (str(b.code_challenge_method) !== "S256" || !CHALLENGE_RE.test(str(b.code_challenge))) return { error: "Ứng dụng không dùng PKCE S256 nên bị từ chối." };
  return { client };
}

async function authorizeInfo(req: Request): Promise<Response> {
  if (limited(`info:${clientIp(req)}`, 60, 60_000)) return oauthError("slow_down", "Thử lại sau.", 429);
  const b = await readBody(req);
  if (!b) return reply({ ok: false, error: "Yêu cầu không hợp lệ." }, 400);
  const r = await checkAuthRequest(b);
  if ("error" in r) return reply({ ok: false, error: r.error });
  return reply({ ok: true, client_name: r.client.client_name, scopes: SCOPES });
}

async function userFromJwt(req: Request): Promise<{ id: string } | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const { data, error } = await admin.auth.getUser(m[1]);
  return error || !data.user ? null : { id: data.user.id };
}

async function approve(req: Request): Promise<Response> {
  const user = await userFromJwt(req);
  if (!user) return reply({ ok: false, error: "Chưa đăng nhập." }, 401);
  if (limited(`approve:${user.id}`, 20, 60_000)) return oauthError("slow_down", "Thao tác quá nhanh.", 429);
  const b = await readBody(req);
  if (!b) return reply({ ok: false, error: "Yêu cầu không hợp lệ." }, 400);
  const r = await checkAuthRequest(b);
  if ("error" in r) return reply({ ok: false, error: r.error }, 400);

  const scope = str(b.scope) as OAuthScope;
  const clanId = str(b.clan_id);
  if (!SCOPES.includes(scope)) return reply({ ok: false, error: "Gói quyền không hợp lệ." }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(clanId)) return reply({ ok: false, error: "Chưa chọn dòng họ." }, 400);

  // Chỉ admin của chính dòng họ đó (hoặc admin hệ thống) được cấp quyền cho AI — như khi tạo token tay.
  const [{ data: member }, { data: profile }] = await Promise.all([
    admin.from("clan_members").select("role").eq("clan_id", clanId).eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("is_suspended, is_platform_admin").eq("id", user.id).maybeSingle(),
  ]);
  if (profile?.is_suspended) return reply({ ok: false, error: "Tài khoản đang bị khoá." }, 403);
  if (member?.role !== "admin" && !profile?.is_platform_admin) {
    return reply({ ok: false, error: "Chỉ quản trị dòng họ mới được kết nối AI cho dòng họ này." }, 403);
  }

  const code = randomSecret("gcd_");
  const { error } = await admin.from("oauth_codes").insert({
    code_hash: await sha256Hex(code),
    client_id: r.client.client_id,
    user_id: user.id,
    clan_id: clanId,
    scope,
    redirect_uri: str(b.redirect_uri),
    code_challenge: str(b.code_challenge),
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (error) return reply({ ok: false, error: "Không tạo được mã cấp quyền." }, 500);
  void admin.from("oauth_clients").update({ last_used_at: new Date().toISOString() }).eq("client_id", r.client.client_id);

  const target = new URL(str(b.redirect_uri));
  target.searchParams.set("code", code);
  const state = str(b.state);
  if (state) target.searchParams.set("state", state);
  return reply({ ok: true, redirect: target.toString() });
}

// ─── Token ────────────────────────────────────────────────────────────────────────
async function issuePair(grantId: string, clientId: string, scope: string, refreshDays = GRANT_TTL_DAYS) {
  const access = randomSecret("gat_");
  const refresh = randomSecret("grt_");
  const now = Date.now();
  const { error } = await admin.from("oauth_tokens").insert([
    { token_hash: await sha256Hex(access), kind: "access", grant_id: grantId, client_id: clientId, expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString() },
    { token_hash: await sha256Hex(refresh), kind: "refresh", grant_id: grantId, client_id: clientId, expires_at: new Date(now + refreshDays * 86_400_000).toISOString() },
  ]);
  if (error) throw new Error(error.message);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope };
}

async function revokeGrant(grantId: string): Promise<void> {
  await admin.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", grantId).is("revoked_at", null);
}

async function exchangeCode(b: Record<string, unknown>): Promise<Response> {
  const code = str(b.code);
  const verifier = str(b.code_verifier);
  if (!/^gcd_[A-Za-z0-9_-]{20,80}$/.test(code) || !VERIFIER_RE.test(verifier)) return oauthError("invalid_grant", "Mã hoặc code_verifier không hợp lệ.");
  const hash = await sha256Hex(code);
  const { data: row } = await admin.from("oauth_codes").select("*").eq("code_hash", hash).maybeSingle();
  if (!row) return oauthError("invalid_grant", "Mã không tồn tại.");
  // Dùng lại mã đã đổi = dấu hiệu bị đánh cắp → thu hồi kết nối đã cấp từ mã đó.
  if (row.used_at) {
    if (row.grant_id) await revokeGrant(row.grant_id as string);
    return oauthError("invalid_grant", "Mã đã được dùng.");
  }
  if (new Date(row.expires_at as string) < new Date()) return oauthError("invalid_grant", "Mã đã hết hạn.");
  if (row.client_id !== str(b.client_id) || row.redirect_uri !== str(b.redirect_uri)) return oauthError("invalid_grant", "Mã không khớp ứng dụng hoặc địa chỉ quay về.");
  if (!(await pkceMatches(verifier, row.code_challenge as string))) return oauthError("invalid_grant", "code_verifier sai.");

  // Đánh dấu đã dùng NGUYÊN TỬ: hai yêu cầu song song chỉ một cái thắng.
  const { data: claimed } = await admin.from("oauth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", hash).is("used_at", null).select("code_hash");
  if (!claimed?.length) return oauthError("invalid_grant", "Mã đã được dùng.");

  const client = await findClient(row.client_id as string);
  if (!client) return oauthError("invalid_grant", "Ứng dụng không còn tồn tại.");
  const { data: grant, error } = await admin
    .from("api_tokens")
    .insert({
      clan_id: row.clan_id,
      user_id: row.user_id,
      name: `${client.client_name} (OAuth)`.slice(0, 80),
      token_hash: await sha256Hex(randomSecret("unused_")), // không ai giữ bản rõ: kết nối chỉ dùng qua oauth_tokens
      token_prefix: "oauth",
      scope: row.scope,
      expires_at: new Date(Date.now() + GRANT_TTL_DAYS * 86_400_000).toISOString(),
      oauth_client_id: client.client_id,
    })
    .select("id")
    .single();
  if (error || !grant) return oauthError("server_error", "Không tạo được kết nối.", 500);
  await admin.from("oauth_codes").update({ grant_id: grant.id }).eq("code_hash", hash);
  return reply(await issuePair(grant.id as string, client.client_id, row.scope as string));
}

async function refresh(b: Record<string, unknown>): Promise<Response> {
  const token = str(b.refresh_token);
  if (!/^grt_[A-Za-z0-9_-]{20,80}$/.test(token)) return oauthError("invalid_grant", "refresh_token không hợp lệ.");
  const hash = await sha256Hex(token);
  const { data: row } = await admin.from("oauth_tokens").select("grant_id, client_id, expires_at, revoked_at").eq("token_hash", hash).eq("kind", "refresh").maybeSingle();
  if (!row) return oauthError("invalid_grant", "refresh_token không tồn tại.");
  if (row.revoked_at) {
    // Refresh token cũ bị dùng lại: có thể đã bị lộ → thu hồi cả kết nối, buộc cấp quyền lại.
    await revokeGrant(row.grant_id as string);
    return oauthError("invalid_grant", "refresh_token đã được dùng; kết nối bị thu hồi để an toàn, hãy kết nối lại.");
  }
  if (new Date(row.expires_at as string) < new Date()) return oauthError("invalid_grant", "refresh_token đã hết hạn.");
  if (str(b.client_id) && row.client_id !== str(b.client_id)) return oauthError("invalid_grant", "refresh_token không thuộc ứng dụng này.");

  const { data: grant } = await admin.from("api_tokens").select("scope, revoked_at, expires_at").eq("id", row.grant_id).maybeSingle();
  if (!grant || grant.revoked_at || new Date(grant.expires_at as string) < new Date()) return oauthError("invalid_grant", "Kết nối đã bị thu hồi hoặc hết hạn.");

  // Xoay vòng nguyên tử.
  const { data: rotated } = await admin.from("oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash).is("revoked_at", null).select("token_hash");
  if (!rotated?.length) {
    await revokeGrant(row.grant_id as string);
    return oauthError("invalid_grant", "refresh_token đã được dùng.");
  }
  // Hạn kết nối trượt: còn dùng thì còn sống, bỏ quên 90 ngày thì tự hết.
  await admin.from("api_tokens").update({ expires_at: new Date(Date.now() + GRANT_TTL_DAYS * 86_400_000).toISOString() }).eq("id", row.grant_id);
  return reply(await issuePair(row.grant_id as string, row.client_id as string, grant.scope as string));
}

async function token(req: Request): Promise<Response> {
  if (limited(`tok:${clientIp(req)}`, 60, 60_000)) return oauthError("slow_down", "Gọi quá nhanh, thử lại sau.", 429);
  const b = await readBody(req);
  if (!b) return oauthError("invalid_request", "Nội dung không hợp lệ.");
  try {
    if (b.grant_type === "authorization_code") return await exchangeCode(b);
    if (b.grant_type === "refresh_token") return await refresh(b);
  } catch (e) {
    console.error("[oauth] token:", (e as Error).message);
    return oauthError("server_error", "Lỗi máy chủ.", 500);
  }
  return oauthError("unsupported_grant_type", "Chỉ hỗ trợ authorization_code và refresh_token.");
}

/** Tra access token OAuth → id kết nối (hàng api_tokens). null nếu không có / hết hạn / bị thu hồi. */
export async function resolveAccessToken(accessToken: string): Promise<string | null> {
  const { data } = await admin
    .from("oauth_tokens")
    .select("grant_id, expires_at, revoked_at")
    .eq("token_hash", await sha256Hex(accessToken))
    .eq("kind", "access")
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at as string) < new Date()) return null;
  return data.grant_id as string;
}

/** Dọn mã hết hạn, token OAuth quá hạn, và client đăng ký rồi bỏ đó (không ai cấp quyền sau 7 ngày). */
export async function sweepOAuth(): Promise<number> {
  const now = new Date();
  const day = new Date(now.getTime() - 86_400_000).toISOString();
  const week = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [c, t] = await Promise.all([
    admin.from("oauth_codes").delete().lt("expires_at", day).select("code_hash"),
    admin.from("oauth_tokens").delete().lt("expires_at", day).select("token_hash"),
  ]);
  const { data: stale } = await admin.from("oauth_clients").select("client_id").lt("created_at", week).is("last_used_at", null).limit(500);
  let removed = 0;
  for (const s of stale ?? []) {
    const { count } = await admin.from("api_tokens").select("id", { count: "exact", head: true }).eq("oauth_client_id", s.client_id);
    if (!count) {
      await admin.from("oauth_clients").delete().eq("client_id", s.client_id);
      removed++;
    }
  }
  return (c.data?.length ?? 0) + (t.data?.length ?? 0) + removed;
}

/** Điều phối các đường dẫn OAuth; trả null nếu không phải đường của OAuth. */
export async function handleOAuth(req: Request, url: URL): Promise<Response | null> {
  const p = url.pathname;
  const isOauth = p.startsWith("/.well-known/oauth-") || p.startsWith("/oauth/");
  if (!isOauth) return null;
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version", "Access-Control-Max-Age": "600" } });
  }
  if (req.method === "GET") {
    if (p === "/.well-known/oauth-protected-resource" || p === "/.well-known/oauth-protected-resource/mcp") return resourceMetadata(req);
    if (p === "/.well-known/oauth-authorization-server") return serverMetadata(req);
    return null;
  }
  if (req.method !== "POST") return null;
  if (p === "/oauth/register") return register(req);
  if (p === "/oauth/token") return token(req);
  if (p === "/oauth/authorize-info") return authorizeInfo(req);
  if (p === "/oauth/approve") return approve(req);
  return null;
}
