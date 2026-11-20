/**
 * community-submit: khách (không tài khoản) góp KÝ ỨC qua link chia sẻ / link mời góp.
 * docs/plan-dong-gop-cong-dong.md — P0.
 *
 * multipart/form-data:
 *   token, kind (story|photo|audio), person_id?, body?, author_name, author_relation?,
 *   guest_key (chuỗi ngẫu nhiên trình duyệt tự sinh, nhớ trong localStorage),
 *   year_approx?, place?, source?, allow_ai_reuse (1|0), website (bẫy bot — phải trống),
 *   elapsed_ms (thời gian từ lúc mở form), file? (ảnh / ghi âm) HOẶC external_url? (link https —
 *   Google Photos, Drive, YouTube… — không tốn ổ cứng server, ưu tiên khi server hạn chế dung lượng)
 *
 * Chống spam (plan §7):
 *   - bẫy `website` có chữ → trả ok giả, không ghi gì;
 *   - điền form < 3 giây → từ chối;
 *   - chữ của khách không được chứa link;
 *   - giới hạn theo IP (đã băm, bộ đếm theo giờ) và theo link;
 *   - giới hạn số file mỗi link; dung lượng ảnh / ghi âm;
 *   - khách MỚI luôn vào hàng chờ; khách đã được duyệt ≥ 3 lần (cùng guest_key) mới được
 *     đăng thẳng — và chỉ khi họ để chế độ "duyệt sau".
 *
 * Service role ghi trực tiếp (bỏ qua RLS); trigger person_memories_before_write bỏ qua
 * khi auth.uid() null nên mọi cột do function này đặt.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IP_PER_HOUR = 20;
const LINK_PER_HOUR = 40;
const MEDIA_PER_LINK = 15;
const MIN_FILL_MS = 3000;
const MAX_GUEST_BODY = 5000;
// Ổ cứng server có hạn: client đã nén ảnh ≤ 200 KB / 1280px và ghi âm ≤ 2 phút (~360 KB);
// server chặn cứng ở mức có dư để không phụ thuộc client.
const MAX_PHOTO_BYTES = 1 * 1024 * 1024;
const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;
const TRUSTED_AFTER_APPROVED = 3;

const PHOTO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, { status });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|vn|info|xyz|top|ru)\b)/i;

const str = (f: FormData, k: string, max: number): string | null => {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Dữ liệu gửi lên không hợp lệ", 400);
  }

  // ─── Bẫy bot ────────────────────────────────────────────────────
  if (str(form, "website", 200)) return json({ ok: true, status: "pending" });
  const elapsed = Number(form.get("elapsed_ms") ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return err("Bạn gửi nhanh quá, vui lòng thử lại", 400);
  }

  const token = str(form, "token", 200);
  const kind = str(form, "kind", 10);
  const personId = str(form, "person_id", 40);
  const body = str(form, "body", MAX_GUEST_BODY + 1);
  const authorName = str(form, "author_name", 80);
  const authorRelation = str(form, "author_relation", 120);
  const guestKeyRaw = str(form, "guest_key", 100);
  const place = str(form, "place", 200);
  const source = str(form, "source", 200);
  const yearRaw = str(form, "year_approx", 6);
  const allowAi = form.get("allow_ai_reuse") !== "0";
  const file = form.get("file");
  const externalRaw = str(form, "external_url", 1000);
  let externalUrl: string | null = null;
  if (externalRaw) {
    try {
      const u = new URL(externalRaw);
      if (u.protocol !== "https:") throw new Error("not https");
      externalUrl = u.toString();
    } catch {
      return err("Link không hợp lệ (phải bắt đầu bằng https://)", 400);
    }
  }

  if (!token) return err("Thiếu link", 400);
  if (!kind || !["story", "photo", "audio"].includes(kind)) return err("Loại ký ức không hợp lệ", 400);
  if (!authorName) return err("Cho biết tên của bạn nhé", 400);
  if (body && body.length > MAX_GUEST_BODY) return err(`Nội dung tối đa ${MAX_GUEST_BODY} chữ`, 400);
  if (kind === "story" && !body) return err("Bạn chưa kể gì", 400);
  if ((kind === "photo" || kind === "audio") && !(file instanceof File) && !externalUrl) {
    return err("Chọn tệp hoặc dán link", 400);
  }
  for (const t of [body, authorName, authorRelation, place, source]) {
    if (t && LINK_RE.test(t)) return err("Vui lòng không dán đường link vào nội dung", 400);
  }
  let yearApprox: number | null = null;
  if (yearRaw) {
    const y = Number(yearRaw);
    if (!Number.isInteger(y) || y < 1000 || y > 2200) return err("Năm không hợp lệ", 400);
    yearApprox = y;
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── Link ───────────────────────────────────────────────────────
  const { data: link, error: linkErr } = await sb
    .from("share_links")
    .select("id, clan_id, scope, expires_at, is_revoked, allow, use_count")
    .eq("token", token)
    .maybeSingle();
  if (linkErr) return err(linkErr.message, 500);
  if (!link) return err("Link không tồn tại", 404);
  if (link.is_revoked) return err("Link đã bị thu hồi", 410);
  if (new Date(link.expires_at) < new Date()) return err("Link đã hết hạn", 410);
  if (link.scope === "resting_place" || link.scope === "heritage_item") {
    return err("Link này không nhận đóng góp", 403);
  }
  const allow = (link.allow ?? {}) as Record<string, unknown>;
  if (allow.memory === false) return err("Link này không nhận ký ức", 403);

  // ─── Người được kể ─────────────────────────────────────────────
  if (personId) {
    const { data: person } = await sb
      .from("persons")
      .select("clan_id, deleted_at")
      .eq("id", personId)
      .maybeSingle();
    if (!person || person.deleted_at) return err("Không tìm thấy người này", 404);
    if (person.clan_id !== link.clan_id) return err("Người này không thuộc dòng họ", 403);
  }

  // ─── Giới hạn tần suất ─────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = await sha256(`community:${ip}`);
  const { data: ipHits } = await sb.rpc("bump_community_submit_rate", { p_bucket: `ip:${ipHash}` });
  if ((ipHits ?? 0) > IP_PER_HOUR) return err("Bạn gửi nhiều quá, nghỉ một lát rồi gửi tiếp nhé", 429);
  const { data: linkHits } = await sb.rpc("bump_community_submit_rate", { p_bucket: `link:${link.id}` });
  if ((linkHits ?? 0) > LINK_PER_HOUR) return err("Link này đang nhận quá nhiều đóng góp, vui lòng thử lại sau", 429);

  // ─── Tệp ────────────────────────────────────────────────────────
  let mediaPath: string | null = null;
  let mediaMime: string | null = null;
  if (!externalUrl && file instanceof File && (kind === "photo" || kind === "audio")) {
    const mime = file.type.split(";")[0].toLowerCase();
    const ext = kind === "photo" ? PHOTO_EXT[mime] : AUDIO_EXT[mime];
    if (!ext) return err(kind === "photo" ? "Chỉ nhận ảnh JPG, PNG, WEBP" : "Định dạng ghi âm không hỗ trợ", 400);
    const max = kind === "photo" ? MAX_PHOTO_BYTES : MAX_AUDIO_BYTES;
    if (file.size > max) return err(`Tệp quá lớn (tối đa ${Math.round(max / 1024 / 1024)} MB)`, 400);
    const { count: mediaCount } = await sb
      .from("person_memories")
      .select("id", { count: "exact", head: true })
      .eq("via_link_id", link.id)
      .not("media_path", "is", null);
    if ((mediaCount ?? 0) >= MEDIA_PER_LINK) return err("Link này đã nhận đủ số ảnh / ghi âm", 429);

    mediaPath = `${link.clan_id}/memories/guest/${crypto.randomUUID()}.${ext}`;
    mediaMime = mime;
    const { error: upErr } = await sb.storage
      .from("person-photos")
      .upload(mediaPath, file, { contentType: mime, upsert: false });
    if (upErr) return err("Không tải tệp lên được, vui lòng thử lại", 500);
  }

  // ─── Khách quen? → quyết định trạng thái ───────────────────────
  const guestKey = guestKeyRaw ? await sha256(`${link.clan_id}:${guestKeyRaw}`) : null;
  const { data: clan } = await sb
    .from("clans")
    .select("memory_moderation")
    .eq("id", link.clan_id)
    .maybeSingle();
  let status: "pending" | "visible" = "pending";
  if (guestKey && clan?.memory_moderation === "post") {
    const { count: approved } = await sb
      .from("person_memories")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", link.clan_id)
      .eq("guest_key", guestKey)
      .eq("status", "visible")
      .not("reviewed_by", "is", null);
    if ((approved ?? 0) >= TRUSTED_AFTER_APPROVED) status = "visible";
  }

  const { data: row, error: insErr } = await sb
    .from("person_memories")
    .insert({
      clan_id: link.clan_id,
      person_id: personId,
      kind,
      body,
      media_path: mediaPath,
      media_mime: mediaMime,
      external_url: kind === "photo" || kind === "audio" ? externalUrl : null,
      year_approx: yearApprox,
      place,
      source,
      allow_ai_reuse: allowAi,
      author_name: authorName,
      author_relation: authorRelation,
      guest_key: guestKey,
      via_link_id: link.id,
      visibility: "share",
      status,
    })
    .select("id, status")
    .single();
  if (insErr) {
    if (mediaPath) await sb.storage.from("person-photos").remove([mediaPath]);
    return err(insErr.message, 500);
  }

  await sb.from("share_links").update({ use_count: (link.use_count ?? 0) + 1 }).eq("id", link.id);

  return json({ ok: true, id: row.id, status: row.status });
});
