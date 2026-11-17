import layoutDocument from "@react-pdf/layout";
import PDFDocument from "@react-pdf/pdfkit";
import renderPDF from "@react-pdf/render";
import { Font, pdf } from "@react-pdf/renderer";
import type { ReactElement } from "react";

import { pageRegistry, resetPageRegistry } from "@/lib/pdf/bookPages";

/**
 * Dựng sổ PDF với MỘT lần dàn trang cả cuốn (cùng cách với mcp-server/src/book.tsx).
 *
 * Mục lục cần số trang của các mục phía sau, mà react-pdf chỉ cho biết số trang của CHÍNH phần tử đang dàn.
 * Cách cũ dựng cả cuốn hai lượt — dàn trang chiếm phần lớn thời gian nên tốn gấp đôi. Cách này:
 *   1. dàn trang cả cuốn một lần → tiêu đề từng mục ghi số trang vào `pageRegistry`;
 *   2. dàn lại RIÊNG trang mục lục (tài liệu nhỏ: trang đệm + mục lục) với số trang thật — rất rẻ;
 *   3. thay trang mục lục trong kết quả bước 1 bằng trang vừa dàn rồi mới ghi PDF.
 * Trang mục lục không đổi số trang giữa hai bản nên số trang các mục khác không lệch. Không khớp dự kiến
 * (không thấy trang mục lục ở vị trí 2) thì lùi về hai lượt đầy đủ: chậm hơn nhưng luôn đúng.
 */
export interface BookDocExtra {
  tocPages?: Record<string, number>;
  tocOnly?: boolean;
}
type Layout = { children: Array<{ children?: unknown[]; value?: string }> };
type Instance = { container: { document: { props?: Record<string, unknown> } } };

const layoutFn = layoutDocument as unknown as (doc: unknown, fonts: unknown) => Promise<Layout>;
const renderFn = renderPDF as unknown as (ctx: unknown, layout: unknown) => {
  on(ev: "data" | "end" | "error", cb: (arg?: never) => void): void;
};
const PdfCtx = PDFDocument as unknown as new (opts: unknown) => unknown;

const hasText = (node: unknown, text: string): boolean => {
  const n = node as { value?: string; children?: unknown[] };
  if (n.value === text) return true;
  return (n.children ?? []).some((c) => hasText(c, text));
};

export async function renderBookWithToc(
  doc: (extra?: BookDocExtra) => ReactElement,
  onStage?: (stage: 1 | 2) => void,
): Promise<Blob> {
  resetPageRegistry();
  onStage?.(1);
  const main = pdf(doc()) as unknown as Instance;
  const layout = await layoutFn(main.container.document, Font);

  const tocIdx = layout.children.findIndex((p) => hasText(p, "Mục lục"));
  if (tocIdx === 1) {
    onStage?.(2);
    const tocInst = pdf(doc({ tocPages: { ...pageRegistry }, tocOnly: true })) as unknown as Instance;
    const tocLayout = await layoutFn(tocInst.container.document, Font);
    const tocPage = tocLayout.children[1];
    if (tocPage && hasText(tocPage, "Mục lục")) {
      layout.children[tocIdx] = tocPage;
      const props = main.container.document.props ?? {};
      const ctx = new PdfCtx({
        compress: true,
        pdfVersion: props.pdfVersion,
        lang: props.language,
        displayTitle: true,
        autoFirstPage: false,
        info: {
          ...(props.title ? { Title: props.title } : {}),
          ...(props.author ? { Author: props.author } : {}),
          ...(props.subject ? { Subject: props.subject } : {}),
          Creator: "react-pdf",
          Producer: "react-pdf",
          CreationDate: new Date(),
        },
      });
      const stream = renderFn(ctx, layout);
      const chunks: Uint8Array[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on("data", ((c: Uint8Array) => chunks.push(c instanceof Uint8Array ? c : new Uint8Array(c))) as never);
        stream.on("end", () => resolve());
        stream.on("error", ((e: unknown) => reject(e)) as never);
      });
      return new Blob(chunks as BlobPart[], { type: "application/pdf" });
    }
  }
  // Không đúng bố cục dự kiến → lượt hai đầy đủ (an toàn).
  onStage?.(2);
  return pdf(doc({ tocPages: { ...pageRegistry } })).toBlob();
}
