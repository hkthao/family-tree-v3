import { pdf } from "@react-pdf/renderer";

import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { getClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";

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
  const photoByPersonId = await fetchPhotoDataUris(data.persons);
  const blob = await pdf(
    <ClanBookPdf
      clan={clan}
      data={data}
      include={options}
      photoByPersonId={photoByPersonId}
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

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}
