/// <reference lib="webworker" />
import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import { renderBookWithToc, type BookDocExtra } from "@/lib/pdf/renderBookInWorker";
import type { ComponentProps } from "react";

export type ClanBookDocProps = Omit<ComponentProps<typeof ClanBookPdf>, "tocPages">;

/**
 * Dựng sổ PDF ngoài luồng giao diện: dòng họ lớn mất vài chục giây dựng bố cục,
 * làm trên luồng chính thì trình duyệt đơ cứng. Dàn trang một lượt (xem renderBookInWorker).
 */
self.onmessage = async (e: MessageEvent<ClanBookDocProps>) => {
  try {
    const doc = (extra: BookDocExtra = {}) => <ClanBookPdf {...e.data} tocPages={extra.tocPages} tocOnly={extra.tocOnly} />;
    const blob = await renderBookWithToc(doc, (stage) => self.postMessage({ type: "progress", stage }));
    self.postMessage({ type: "done", blob });
  } catch (err) {
    self.postMessage({ type: "error", message: (err as Error)?.message ?? String(err) });
  }
};
