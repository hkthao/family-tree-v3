import type { ClanBookDocProps } from "@/lib/pdf/clanBook.worker";

import type { BookWatermarkId } from "@/lib/pdf/bookWatermarks";
import { bookFilename } from "@/lib/pdf/bookFilename";
import { makeCoverQr } from "@/lib/pdf/coverQr";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { HONOR_CATEGORY_LABEL } from "@/lib/queries/honor";
import { withExportSlot } from "@/lib/pdf/exportSlot";
import { getClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";

export interface ExportClanBookOptions {
  tree?: boolean;
  /** Kèm trang "Cây thư mục" khổ tự tính (mặc định có). */
  folderTree?: boolean;
  detail?: boolean;
  /** Số thành viên ("lá") tối đa mỗi trang sơ đồ cây. Ít → thẻ to, dễ đọc;
   *  nhiều → gói được nhiều đời/người trên một trang. */
  treePerPage?: number;
  /** Vẽ cả sơ đồ trên MỘT trang khổ tự tính (mặc định); false = tách
   *  nhiều trang A4 theo đời. */
  treeSinglePage?: boolean;
  /** Hình nền mờ in chìm dưới mọi trang. Bỏ trống = phượng (mặc định);
   *  null = không có hình nền. */
  watermark?: BookWatermarkId | null;
  /**
   * Gốc địa chỉ cho mã QR ở trang bìa (link xem gia phả công khai). Mặc định
   * là trang đang mở; Zalo Mini App chạy dưới địa chỉ của Zalo nên phải
   * truyền địa chỉ trang web vào, không thì QR trỏ về một trang không có.
   */
  shareOrigin?: string;
  /** Báo tiến độ: "queued" (chờ tới lượt vì hệ thống đang có nhiều người xuất sổ), "data" (tải dữ liệu/ảnh), "layout1" (dàn trang), "layout2" (in mục lục). */
  onProgress?: (stage: "queued" | "data" | "layout1" | "layout2") => void;
}

/**
 * Mặc định đặt Ở ĐÂY chứ không ở từng nút bấm: sổ xuất từ trang Cây, từ
 * Dashboard hay từ nút "Xuất sổ gia phả PDF" phải ra cùng một kiểu, nếu
 * không người dùng bấm hai chỗ sẽ nhận hai cuốn khác nhau.
 */
const DEFAULT_WATERMARK: BookWatermarkId = "phoenix";

/**
 * Fetch clan data and render the React-PDF document to a Blob.
 *
 * Tách khỏi phần "bấm tải về" vì cách trả file là chuyện của từng nơi:
 * trang web tạo link tạm rồi tự bấm, còn Zalo Mini App phải đưa file lên
 * kho lưu trữ rồi mở bằng trình xem tài liệu của Zalo.
 */
export async function buildClanBookPdf(
  clan: ClanDetail,
  options: ExportClanBookOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  // onProgress là hàm: không đi qua postMessage sang worker được, nên tách khỏi `include`.
  const { onProgress, ...includeOptions } = options;
  // Phần tốn server (lấy dữ liệu + tải ảnh) chạy trong "chỗ xuất sổ" để giới hạn số lượt cùng lúc.
  const { data, photoByPersonId, coverByItemId } = await withExportSlot(
    clan.id,
    () => onProgress?.("queued"),
    async () => {
      onProgress?.("data");
      const data = await getClanBookData(clan.id);
      const [photoByPersonId, coverByItemId] = await Promise.all([
        fetchPhotoDataUris(data.persons),
        fetchCoverDataUris([
          ...data.heritage.map((h) => ({ id: h.id, path: h.cover_path, url: h.cover_url })),
          ...data.restingPlaces.map((r) => ({ id: r.id, path: r.cover_path })),
        ]),
      ]);
      return { data, photoByPersonId, coverByItemId };
    },
  );
  // QR trang bìa → link gia phả công khai; lỗi thì không có QR.
  const coverQrDataUri = await makeCoverQr(clan.id, options.shareOrigin ?? window.location.origin);

  const docProps = {
    clan,
    data,
    include: {
      ...includeOptions,
      treeSinglePage: options.treeSinglePage ?? true,
      watermark:
        options.watermark === undefined
          ? DEFAULT_WATERMARK
          : (options.watermark ?? undefined),
    },
    photoByPersonId,
    coverByItemId,
    coverQrDataUri,
    // Giải nhãn ở luồng chính (nơi có ngôn ngữ đang chọn) rồi đưa sang worker dưới dạng chuỗi thường.
    honorLabels: { ...HONOR_CATEGORY_LABEL },
  };

  // Dựng ở Web Worker để trình duyệt không đơ với dòng họ lớn; môi trường không
  // chạy được worker (vd Zalo Mini App) lùi về dựng ngay trên luồng chính.
  const blob =
    (await renderInWorker(docProps, onProgress)) ??
    (await renderOnMainThread(docProps));

  const filename = bookFilename(clan.name);
  return { blob, filename };
}

/**
 * Dựng sổ rồi kích hoạt tải về trong trình duyệt. Trả về tên file gợi ý để
 * nơi gọi hiện trong thông báo.
 */
export async function downloadClanBookPdf(
  clan: ClanDetail,
  options: ExportClanBookOptions = {},
): Promise<{ filename: string; bytes: number }> {
  const { blob, filename } = await buildClanBookPdf(clan, options);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, bytes: blob.size };
}

/**
 * Pre-fetch every person photo as a JPEG data URI so @react-pdf can
 * embed it synchronously at render time. Doing this upfront avoids
 * CORS races inside the renderer and keeps the photo bytes in memory
 * exactly once even when a person appears on multiple pages.
 *
 * Photos are already compressed to ~80 KB by the upload pipeline, so
 * a 200-person clan adds at most ~16 MB to the in-memory bundle —
 * acceptable, and shrinks again once the PDF is serialised.
 *
 * Persons whose signed URL or fetch fails are silently absent from
 * the returned map; the renderer falls back to the gendered avatar.
 */
async function fetchPhotoDataUris(
  persons: { id: string; photo_path: string | null }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const withPhotos = persons.filter(
    (p): p is { id: string; photo_path: string } => !!p.photo_path,
  );
  if (withPhotos.length === 0) return out;

  const urlMap = await getSignedPhotoUrlMap(
    withPhotos.map((p) => p.photo_path),
  );

  await mapPool(
    withPhotos,
    async (p) => {
      const url = urlMap.get(p.photo_path);
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUri = await blobToDataUri(blob);
        out.set(p.id, dataUri);
      } catch {
        // network blip / 403 — leave the person photo-less; the renderer
        // will draw the gendered avatar instead. Better than aborting
        // the whole export over one missing image.
      }
    },
  );

  return out;
}

/**
 * Tải ảnh bìa (Mộ phần / Di sản) thành data URI cho @react-pdf. Nguồn có
 * thể là bucket (ký URL) hoặc link ngoài (dùng trực tiếp). Item nào lỗi
 * thì bỏ qua (thẻ không có ảnh).
 */
async function fetchCoverDataUris(
  items: { id: string; path?: string | null; url?: string | null }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const bucketPaths = items
    .map((i) => i.path)
    .filter((p): p is string => !!p);
  const urlMap = bucketPaths.length ? await getSignedPhotoUrlMap(bucketPaths) : new Map<string, string>();
  await mapPool(
    items,
    async (i) => {
      const src = i.path ? urlMap.get(i.path) : i.url ?? undefined;
      if (!src) return;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const blob = await res.blob();
        out.set(i.id, await blobToDataUri(blob));
      } catch {
        /* bỏ qua ảnh lỗi */
      }
    },
  );
  return out;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

type Stage = "queued" | "data" | "layout1" | "layout2";

/** Trả null nếu không dùng được worker (để nơi gọi lùi về luồng chính). */
function renderInWorker(
  props: ClanBookDocProps,
  onProgress?: (s: Stage) => void,
): Promise<Blob | null> {
  if (typeof Worker === "undefined") return Promise.resolve(null);
  let worker: Worker;
  try {
    worker = new Worker(new URL("./clanBook.worker.tsx", import.meta.url), {
      type: "module",
    });
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    let started = false;
    worker.onmessage = (e: MessageEvent) => {
      started = true;
      const m = e.data as
        | { type: "progress"; stage: 1 | 2 }
        | { type: "done"; blob: Blob }
        | { type: "error"; message: string };
      if (m.type === "progress") onProgress?.(m.stage === 1 ? "layout1" : "layout2");
      else if (m.type === "done") {
        worker.terminate();
        resolve(m.blob);
      } else {
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    // Worker không nạp được (trước khi nhận tin nào) → lùi về luồng chính.
    worker.onerror = () => {
      worker.terminate();
      if (started) reject(new Error("Không dựng được sổ PDF"));
      else resolve(null);
    };
    try {
      worker.postMessage(props);
    } catch {
      worker.terminate();
      resolve(null);
    }
  });
}

async function renderOnMainThread(props: ClanBookDocProps): Promise<Blob> {
  const [{ pdf }, { pageRegistry, resetPageRegistry }, { ClanBookPdf }] =
    await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/pdf/bookPages"),
      import("@/lib/pdf/ClanBookPdf"),
    ]);
  const doc = (tocPages?: Record<string, number>) => (
    <ClanBookPdf {...props} tocPages={tocPages} />
  );
  // Hai lượt: lượt một để tiêu đề từng mục ghi số trang của nó, lượt hai in
  // các số đó vào mục lục (xem bookPages).
  resetPageRegistry();
  await pdf(doc()).toBlob();
  const tocPages = { ...pageRegistry };
  return pdf(doc(tocPages)).toBlob();
}

/** Chạy `fn` cho từng phần tử, tối đa `limit` việc cùng lúc (dòng họ lớn có hàng nghìn ảnh). */
async function mapPool<T>(items: T[], fn: (x: T) => Promise<void>, limit = 8): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}
