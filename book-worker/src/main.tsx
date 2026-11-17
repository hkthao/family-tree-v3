/**
 * book-worker — dịch vụ dựng Sổ gia phả PDF chạy trên máy chủ riêng (xem docs/plan-may-chu-xuat-so.md).
 *
 * Vòng lặp: báo "còn sống" → nhận một việc từ `export_jobs` (claim_export_job, SKIP LOCKED) → đọc dữ liệu dòng họ bằng
 * service role → dựng PDF bằng CHÍNH `ClanBookPdf` của app (cùng cách dàn trang một lượt như worker trình duyệt) → đưa lên
 * bucket private `book-exports/<uid>/…` → ghi trạng thái. Một việc một lúc (dựng sổ ngốn RAM); máy yếu thì tự chậm lại.
 *
 * An toàn: service role bỏ qua RLS nên việc kiểm quyền nằm ở `create_export_job` (người tạo phải là thành viên dòng họ);
 * worker chỉ đọc dòng họ ghi trong việc và chỉ ghi file vào thư mục của đúng người tạo. Không tải ảnh từ URL ngoài
 * (chống SSRF) — chỉ ảnh trong bucket.
 */
import { createHash } from "node:crypto";
import os from "node:os";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import { renderBookWithToc, type BookDocExtra } from "@/lib/pdf/renderBookInWorker";
import { getClanBookData } from "@/lib/queries/clan-book";
import { getClanDetail } from "@/lib/queries/clan-detail";

import { photoDataUris, useLocalAssets } from "../../mcp-server/src/book.tsx";

declare const __PDF_LAYOUT_HASH__: string | undefined;
const LAYOUT_HASH = typeof __PDF_LAYOUT_HASH__ === "string" ? __PDF_LAYOUT_HASH__ : "dev";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const WORKER_ID = process.env.WORKER_ID ?? os.hostname();
const MAX_PERSONS = Number(process.env.MAX_PERSONS ?? 400);
const POLL_MS = Number(process.env.POLL_MS ?? 3000);
const BUCKET = "book-exports";
const KEEP_DAYS = Number(process.env.KEEP_DAYS ?? 3);

/** Lỗi có thông điệp an toàn để hiện cho người dùng (khác lỗi hệ thống, chỉ ghi log). */
class UserError extends Error {}

interface Job {
  id: string;
  user_id: string;
  clan_id: string;
  options: Record<string, unknown>;
  person_count: number | null;
}

const WATERMARKS = ["phoenix", "dragon", "none"] as const;
function sanitizeOptions(o: Record<string, unknown>) {
  const bool = (k: string, d: boolean) => (typeof o[k] === "boolean" ? (o[k] as boolean) : d);
  const wm = o.watermark === undefined ? "phoenix" : String(o.watermark);
  if (!(WATERMARKS as readonly string[]).includes(wm)) throw new UserError("Tuỳ chọn hình nền không hợp lệ.");
  const tpp = o.treePerPage;
  if (tpp !== undefined && tpp !== null && (!Number.isInteger(tpp) || (tpp as number) < 4 || (tpp as number) > 60)) {
    throw new UserError("Số thẻ mỗi trang sơ đồ phải từ 4 đến 60.");
  }
  const qr = typeof o.coverQrDataUri === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(o.coverQrDataUri) && o.coverQrDataUri.length < 200_000 ? o.coverQrDataUri : undefined;
  return {
    opts: {
      tree: bool("tree", true),
      folderTree: bool("folderTree", true),
      detail: bool("detail", true),
      treePerPage: typeof tpp === "number" ? tpp : undefined,
      treeSinglePage: bool("treeSinglePage", true),
      watermark: wm === "none" ? undefined : (wm as "phoenix" | "dragon"),
    },
    qr,
  };
}

const setJob = (id: string, patch: Record<string, unknown>) => db.from("export_jobs").update(patch).eq("id", id);

async function process_(job: Job): Promise<void> {
  const stage = (s: string) => void setJob(job.id, { stage: s, heartbeat_at: new Date().toISOString() }).then(() => undefined);
  const { opts, qr } = sanitizeOptions(job.options ?? {});

  const clan = await getClanDetail(job.clan_id, job.user_id, db as never);
  if (!clan) throw new UserError("Không đọc được dòng họ.");
  // Lớp bảo vệ thứ hai: service role bỏ qua RLS nên kiểm lại người tạo việc còn là thành viên (hoặc admin hệ thống).
  if (!clan.myRole && !clan.isPlatformAdmin) throw new UserError("Bạn không còn quyền với dòng họ này.");
  const { count } = await db.from("persons").select("id", { count: "exact", head: true }).eq("clan_id", job.clan_id).is("deleted_at", null);
  if ((count ?? 0) > MAX_PERSONS) throw new UserError(`Dòng họ có ${count} người, vượt giới hạn ${MAX_PERSONS} của máy chủ xuất sổ. Hãy xuất ngay trên trình duyệt.`);

  const data = await getClanBookData(job.clan_id, db as never);
  const { data: stamps } = await db.from("persons").select("id, updated_at").eq("clan_id", job.clan_id).is("deleted_at", null).order("id").range(0, 9999);
  const { myRole: _r, isPlatformAdmin: _p, ...clanStable } = clan as unknown as Record<string, unknown>;
  const fp = createHash("sha256")
    .update(JSON.stringify({ v: LAYOUT_HASH, opts, qr: !!qr, clan: clanStable, data, stamps: (stamps ?? []).map((x) => `${x.id}@${x.updated_at}`) }))
    .digest("hex")
    .slice(0, 24);
  const objectName = `book-${job.clan_id}-${fp}.pdf`;
  const objectPath = `${job.user_id}/${objectName}`;

  // Cache: dữ liệu + tuỳ chọn + mã dựng không đổi thì dùng lại file đã dựng.
  const { data: existing } = await db.storage.from(BUCKET).list(job.user_id, { search: objectName, limit: 5 });
  const hit = (existing ?? []).find((f) => f.name === objectName);
  if (hit) {
    const bytes = (hit.metadata as { size?: number } | null)?.size ?? null;
    await setJob(job.id, { status: "done", stage: null, file_path: objectPath, bytes, finished_at: new Date().toISOString() });
    return;
  }

  stage("photos");
  useLocalAssets();
  const photoByPersonId = await photoDataUris(db, data.persons.filter((p) => p.photo_path).map((p) => ({ id: p.id, path: p.photo_path as string })));
  // Ảnh bìa Mộ phần / Di sản: chỉ ảnh trong bucket (link ngoài bị bỏ để tránh SSRF).
  const coverItems = [...data.heritage.map((h) => ({ id: h.id, path: h.cover_path })), ...data.restingPlaces.map((r) => ({ id: r.id, path: r.cover_path }))].filter((c): c is { id: string; path: string } => !!c.path);
  const coverByItemId = await photoDataUris(db, coverItems);

  const doc = (extra: BookDocExtra = {}) => (
    <ClanBookPdf clan={clan} data={data} include={opts} photoByPersonId={photoByPersonId} coverByItemId={coverByItemId} coverQrDataUri={qr} tocPages={extra.tocPages} tocOnly={extra.tocOnly} />
  );
  stage("layout");
  const blob = await renderBookWithToc(doc, (s) => stage(s === 1 ? "layout" : "toc"));
  const pdf = Buffer.from(await blob.arrayBuffer());

  stage("upload");
  const up = await db.storage.from(BUCKET).upload(objectPath, pdf, { upsert: true, contentType: "application/pdf", cacheControl: "60" });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  await setJob(job.id, { status: "done", stage: null, file_path: objectPath, bytes: pdf.length, finished_at: new Date().toISOString() });
}

let stopping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function beat() {
  const { error } = await db.from("export_workers").upsert({ id: WORKER_ID, seen_at: new Date().toISOString(), max_persons: MAX_PERSONS });
  if (error) console.error("heartbeat:", error.message);
}

/** Dọn việc cũ (7 ngày) và file đã quá hạn giữ (KEEP_DAYS). */
async function sweep() {
  const fileCutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString();
  const { data: olds } = await db.from("export_jobs").select("id, file_path").lt("finished_at", fileCutoff).not("file_path", "is", null).limit(200);
  const paths = [...new Set((olds ?? []).map((j) => j.file_path as string))];
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  if (olds?.length) await db.from("export_jobs").update({ file_path: null }).in("id", olds.map((j) => j.id));
  await db.from("export_jobs").delete().lt("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()).in("status", ["done", "failed", "cancelled"]);
}

async function main() {
  console.log(`book-worker ${WORKER_ID} bắt đầu (trần ${MAX_PERSONS} người)`);
  process.on("SIGTERM", () => { stopping = true; });
  process.on("SIGINT", () => { stopping = true; });
  await beat();
  setInterval(() => void beat(), 30_000).unref();
  setInterval(() => void sweep().catch((e) => console.error("sweep:", e?.message)), 3600_000).unref();

  while (!stopping) {
    const { data, error } = await db.rpc("claim_export_job", { p_worker: WORKER_ID });
    if (error) { console.error("claim:", error.message); await sleep(POLL_MS * 2); continue; }
    const job = data as Job | null;
    if (!job) { await sleep(POLL_MS); continue; }

    const t0 = Date.now();
    const pulse = setInterval(() => void setJob(job.id, { heartbeat_at: new Date().toISOString() }).then(() => undefined), 20_000);
    try {
      await process_(job);
      console.log(`việc ${job.id} xong sau ${Math.round((Date.now() - t0) / 1000)}s`);
    } catch (e) {
      const err = e as Error;
      console.error(`việc ${job.id} lỗi:`, err.message);
      await setJob(job.id, {
        status: "failed",
        stage: null,
        error: err instanceof UserError ? err.message : "Không dựng được sổ. Hãy thử lại hoặc xuất ngay trên trình duyệt.",
        finished_at: new Date().toISOString(),
      });
    } finally {
      clearInterval(pulse);
    }
  }
  console.log("book-worker dừng");
}

main().catch((e) => { console.error(e); process.exit(1); });
