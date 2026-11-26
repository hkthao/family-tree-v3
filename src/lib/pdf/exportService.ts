import type { ExportClanBookOptions } from "@/lib/pdf/exportClanBook";
import { bookFilename } from "@/lib/pdf/bookFilename";
import { makeCoverQr } from "@/lib/pdf/coverQr";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { supabase } from "@/lib/supabase";

type Stage = NonNullable<ExportClanBookOptions["onProgress"]> extends (s: infer S) => void ? S : never;

interface JobState {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  stage: string | null;
  error: string | null;
  file_path: string | null;
  bytes: number | null;
  position: number;
  worker_alive: boolean;
}

/** Quá hạn này mà chưa xong thì bỏ, lùi về dựng tại máy. */
const MAX_TOTAL_MS = 15 * 60_000;
/** Việc nằm chờ mà không có worker nào còn sống quá lâu → lùi về dựng tại máy. */
const DEAD_WORKER_MS = 45_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Xuất sổ ở MÁY CHỦ (dịch vụ book-worker): tạo việc, theo dõi, rồi tải file. Trả null khi không dùng được dịch vụ
 * (tắt, dòng họ vượt giới hạn, hàng đợi đầy, việc lỗi, quá hạn) để nơi gọi tự lùi về dựng ngay trên trình duyệt —
 * người dùng luôn xuất được. Chỉ ném lỗi khi người dùng không phải thành viên dòng họ.
 */
export async function tryServerExport(
  clan: ClanDetail,
  options: ExportClanBookOptions,
): Promise<{ filename: string; bytes: number } | null> {
  const { onProgress } = options;
  const qr = await makeCoverQr(clan.id, options.shareOrigin ?? window.location.origin);
  const payload = {
    tree: options.tree,
    folderTree: options.folderTree,
    detail: options.detail,
    treePerPage: options.treePerPage,
    treeSinglePage: options.treeSinglePage ?? true,
    treeUnlinked: options.treeUnlinked ?? false,
    watermark: options.watermark === null ? "none" : (options.watermark ?? "phoenix"),
    coverQrDataUri: qr,
  };

  const created = await supabase.rpc("create_export_job", { p_clan: clan.id, p_options: payload });
  if (created.error) {
    if (/clan member/i.test(created.error.message)) throw new Error(created.error.message);
    return null; // service_unavailable | too_large | queue_full | hạ tầng
  }
  const jobId = (created.data as unknown as { id: string }).id;

  const started = Date.now();
  let deadSince: number | null = null;
  let delay = 1500;
  for (;;) {
    if (Date.now() - started > MAX_TOTAL_MS) {
      await supabase.rpc("cancel_export_job", { p_id: jobId });
      return null;
    }
    await sleep(delay);
    delay = Math.min(delay + 500, 4000);

    const r = await supabase.rpc("get_export_job", { p_id: jobId });
    const job = r.data as unknown as JobState | null;
    if (r.error || !job) return null;

    if (job.status === "done" && job.file_path) return download(job.file_path, bookFilename(clan.name), job.bytes);
    if (job.status === "failed" || job.status === "cancelled") return null;

    if (job.status === "queued") {
      onProgress?.("queued" satisfies Stage);
      if (!job.worker_alive) {
        deadSince ??= Date.now();
        if (Date.now() - deadSince > DEAD_WORKER_MS) {
          await supabase.rpc("cancel_export_job", { p_id: jobId });
          return null;
        }
      } else deadSince = null;
    } else {
      deadSince = null;
      onProgress?.(job.stage === "toc" || job.stage === "upload" ? "layout2" : job.stage === "layout" ? "layout1" : "data");
    }
  }
}

async function download(path: string, filename: string, bytes: number | null): Promise<{ filename: string; bytes: number } | null> {
  const signed = await supabase.storage.from("book-exports").createSignedUrl(path, 300, { download: filename });
  if (signed.error || !signed.data?.signedUrl) return null;
  const a = document.createElement("a");
  a.href = signed.data.signedUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { filename, bytes: bytes ?? 0 };
}
