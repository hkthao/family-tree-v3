/// <reference lib="webworker" />
import { pdf } from "@react-pdf/renderer";

import { pageRegistry, resetPageRegistry } from "@/lib/pdf/bookPages";
import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import type { ComponentProps } from "react";

export type ClanBookDocProps = Omit<ComponentProps<typeof ClanBookPdf>, "tocPages">;

/**
 * Dựng sổ PDF ngoài luồng giao diện: dòng họ lớn mất vài chục giây dựng bố cục,
 * làm trên luồng chính thì trình duyệt đơ cứng. Hai lượt như `buildClanBookPdf`
 * (lượt một thu số trang cho mục lục).
 */
self.onmessage = async (e: MessageEvent<ClanBookDocProps>) => {
  try {
    const doc = (tocPages?: Record<string, number>) => <ClanBookPdf {...e.data} tocPages={tocPages} />;
    resetPageRegistry();
    self.postMessage({ type: "progress", stage: 1 });
    await pdf(doc()).toBlob();
    const tocPages = { ...pageRegistry };
    self.postMessage({ type: "progress", stage: 2 });
    const blob = await pdf(doc(tocPages)).toBlob();
    self.postMessage({ type: "done", blob });
  } catch (err) {
    self.postMessage({ type: "error", message: (err as Error)?.message ?? String(err) });
  }
};
