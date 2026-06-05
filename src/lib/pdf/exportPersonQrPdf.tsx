import { pdf } from "@react-pdf/renderer";

import {
  PersonQrBulkPdf,
  PersonQrSinglePdf,
  type QrCardItem,
} from "@/lib/pdf/QrCardPdf";
import { getOrCreatePersonShareLink } from "@/lib/queries/share-links";

/**
 * Input for building a single QR card. Caller supplies the person
 * facts; we mint (or reuse) the share link and generate the QR PNG
 * data URL ourselves so the PDF render stays synchronous.
 */
export interface PersonQrInput {
  clanId: string;
  personId: string;
  fullName: string;
  courtesyName: string | null;
  generation: number | null;
  birthYear: string | null;
  deathYear: string | null;
  isLiving: boolean;
}

/**
 * Concurrency-capped Promise.all. Walks `items`, runs `worker` on each
 * with at most `limit` in flight. Used to mint share links + render
 * QR PNGs for a 100-person bulk export without flooding Supabase.
 */
async function mapConcurrent<I, O>(
  items: I[],
  limit: number,
  worker: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    out[i] = await worker(items[i], i);
    return next();
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return out;
}

async function buildQrCardItem(
  input: PersonQrInput,
  origin: string,
): Promise<QrCardItem> {
  const link = await getOrCreatePersonShareLink(input.clanId, input.personId);
  const url = `${origin}/share/${link.token}`;
  // Lazy import so the qrcode dependency only loads when exporting.
  const QR = (await import("qrcode")).default;
  const qrDataUrl = await QR.toDataURL(url, {
    width: 600,
    margin: 1,
    color: { dark: "#1F1A17", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
  return {
    id: input.personId,
    fullName: input.fullName,
    courtesyName: input.courtesyName,
    generation: input.generation,
    birthYear: input.birthYear,
    deathYear: input.deathYear,
    isLiving: input.isLiving,
    qrDataUrl,
  };
}

function safeFilenamePart(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download a one-card A6 PDF for a single person — the "Tải PDF
 * danh thiếp" button on the personal QR modal.
 */
export async function downloadSinglePersonQrPdf(
  clanName: string,
  input: PersonQrInput,
): Promise<{ filename: string }> {
  const item = await buildQrCardItem(input, window.location.origin);
  const blob = await pdf(
    <PersonQrSinglePdf clanName={clanName} items={[item]} />,
  ).toBlob();
  const filename = `qr_${safeFilenamePart(input.fullName)}.pdf`;
  triggerDownload(blob, filename);
  return { filename };
}

/**
 * Download a bulk A4 PDF (4 cards per page) for many persons. Mints
 * share links in parallel, capped to avoid hammering Supabase.
 */
export async function downloadBulkPersonQrPdf(
  clanName: string,
  inputs: PersonQrInput[],
): Promise<{ filename: string; count: number }> {
  const origin = window.location.origin;
  const items = await mapConcurrent(inputs, 6, (i) => buildQrCardItem(i, origin));
  const blob = await pdf(
    <PersonQrBulkPdf clanName={clanName} items={items} />,
  ).toBlob();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `qr-bulk_${safeFilenamePart(clanName)}_${today}.pdf`;
  triggerDownload(blob, filename);
  return { filename, count: items.length };
}
