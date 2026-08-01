/**
 * cleanup-card-shares: dọn các link "khoe" (card_shares) đã hết hạn.
 *
 * Thay cho pg_cron job cũ `delete-expired-card-shares` — job đó xoá
 * thẳng `storage.objects` bằng SQL nên bị trigger `protect_objects_delete`
 * của storage self-host chặn ("Direct deletion from storage tables is not
 * allowed"), làm rollback cả transaction ⇒ không dọn được gì.
 *
 * Ở đây ta dùng Storage API (`storage.remove`) để xoá FILE thật (không
 * mồ côi), rồi mới xoá row card_shares.
 *
 * Triggering: host cron (17 3 * * *) POST kèm header X-Cron-Token — cùng
 * cơ chế với notify-events. Body rỗng {}.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
const BUCKET = "card-shares";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (CRON_TOKEN && req.headers.get("X-Cron-Token") !== CRON_TOKEN) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Chốt một mốc thời gian dùng chung cho cả select lẫn delete, tránh
  // kẽ hở: link vừa hết hạn giữa hai câu lệnh sẽ được xử lý trọn vẹn ở
  // lần chạy sau chứ không bị xoá row mà còn file (hoặc ngược lại).
  const cutoff = new Date().toISOString();

  const { data: expired, error: selErr } = await supabase
    .from("card_shares")
    .select("id, image_path")
    .lte("expires_at", cutoff);
  if (selErr) return json({ error: selErr.message }, { status: 500 });

  const rows = expired ?? [];
  const errors: string[] = [];

  // 1) Xoá FILE qua Storage API (chunk để tránh payload quá lớn).
  const paths = rows
    .map((r) => r.image_path as string | null)
    .filter((p): p is string => !!p);
  let filesRemoved = 0;
  const CHUNK = 100;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const slice = paths.slice(i, i + CHUNK);
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(slice);
    if (rmErr) errors.push(`storage.remove: ${rmErr.message}`);
    else filesRemoved += slice.length;
  }

  // 2) Xoá ROW. Chỉ xoá tới đúng mốc cutoff đã select ở trên.
  const { data: deleted, error: delErr } = await supabase
    .from("card_shares")
    .delete()
    .lte("expires_at", cutoff)
    .select("id");
  if (delErr) errors.push(`delete rows: ${delErr.message}`);

  return json({
    cutoff,
    expired: rows.length,
    filesRemoved,
    rowsDeleted: deleted?.length ?? 0,
    errors,
  });
});
