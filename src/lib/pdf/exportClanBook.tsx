import { pdf } from "@react-pdf/renderer";

import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import { makeQrDataUrl } from "@/lib/cards/exportCard";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { getClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { getOrCreateTreeShareLink } from "@/lib/queries/share-links";

export interface ExportClanBookOptions {
  tree?: boolean;
  detail?: boolean;
}

/**
 * Fetch clan data, render the React-PDF document to a Blob, and trigger
 * a browser download. Returns the suggested filename so callers can
 * surface it in toasts.
 */
export async function downloadClanBookPdf(
  clan: ClanDetail,
  options: ExportClanBookOptions = {},
): Promise<{ filename: string; bytes: number }> {
  const data = await getClanBookData(clan.id);
  const [photoByPersonId, coverByItemId] = await Promise.all([
    fetchPhotoDataUris(data.persons),
    fetchCoverDataUris([
      ...data.heritage.map((h) => ({ id: h.id, path: h.cover_path, url: h.cover_url })),
      ...data.restingPlaces.map((r) => ({ id: r.id, path: r.cover_path })),
    ]),
  ]);
  // QR trang bìa → link gia phả công khai (ai cũng xem được, không cần
  // đăng nhập). Lỗi (vd không tạo được link) thì bỏ qua, không có QR.
  let coverQrDataUri: string | undefined;
  try {
    const link = await getOrCreateTreeShareLink(clan.id);
    const url = `${window.location.origin}/share/${link.token}`;
    coverQrDataUri = (await makeQrDataUrl(url)) ?? undefined;
  } catch {
    /* không có QR */
  }

  const blob = await pdf(
    <ClanBookPdf
      clan={clan}
      data={data}
      include={options}
      photoByPersonId={photoByPersonId}
      coverByItemId={coverByItemId}
      coverQrDataUri={coverQrDataUri}
    />,
  ).toBlob();

  const safe = clan.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `gia-pha_${safe}_${today}.pdf`;

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

  await Promise.all(
    withPhotos.map(async (p) => {
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
    }),
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
  await Promise.all(
    items.map(async (i) => {
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
    }),
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
