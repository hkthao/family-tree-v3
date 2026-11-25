/**
 * Xuất Sổ gia phả PDF qua MCP: dựng bằng CHÍNH `ClanBookPdf` của app (cùng bố cục, mục lục, sơ đồ cây), lưu
 * file tạm vào bucket private `book-exports` rồi trả link tải có hạn.
 *
 *  - Lưu ở `<uid>/mcp-<clan_id>.pdf` — một file cố định mỗi (người, dòng họ), ghi đè nên không tích rác; thư mục
 *    mang id người gọi nên chỉ người đó đọc được (policy của bucket), dù lộ tên file.
 *  - Link ký (signed URL) hết hạn sau 30 phút; `sweepExports()` định kỳ xoá file quá 24 giờ.
 *  - KHÔNG tạo link chia sẻ công khai làm tác dụng phụ (app tạo để in mã QR ở bìa; AI thì không nên tự mở
 *    dữ liệu ra công khai) → sổ xuất từ MCP không có mã QR ở trang bìa.
 *  - Dựng sổ tốn RAM/CPU: chạy từng cái một, và có trần số người.
 */

import { createHash } from "node:crypto";
import path from "node:path";

import layoutDocument from "@react-pdf/layout";
import PDFDocument from "@react-pdf/pdfkit";
import renderPDF from "@react-pdf/render";
import { Font, pdf as reactPdf, renderToBuffer } from "@react-pdf/renderer";
import type React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { pageRegistry, resetPageRegistry } from "@/lib/pdf/bookPages";
import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import { pdfAssets } from "@/lib/pdf/pdfAssets";
import { getClanBookData } from "@/lib/queries/clan-book";
import { getClanDetail } from "@/lib/queries/clan-detail";

import { UserError } from "./fields.ts";
import type { Ctx } from "./ops.ts";

/**
 * Băm mã dựng sổ (src/lib/pdf, dữ liệu sổ, file này) do build.mjs chèn vào lúc build. Đổi bố cục sổ → băm đổi →
 * mọi file cache cũ tự vô hiệu. Chạy ngoài bản build (test/dev) thì dùng "dev".
 */
declare const __PDF_LAYOUT_HASH__: string | undefined;
const LAYOUT_HASH = typeof __PDF_LAYOUT_HASH__ === "string" ? __PDF_LAYOUT_HASH__ : "dev";

const BUCKET = "book-exports";
const LINK_TTL_SECONDS = 30 * 60;
/** Trần đã đo an toàn với heap 600 MB (800 người ≈ 0,8 GB RSS). Cao hơn có nguy cơ hết heap làm sập container. */
const MAX_PERSONS = 1000;
/** Giữ file sổ tạm bao nhiêu giờ trước khi dọn (chỉnh được bằng MCP_EXPORT_KEEP_HOURS). */
/** Số bản sổ gần nhất giữ lại cho mỗi (người, dòng họ). */
const KEEP_VERSIONS = 3;
const KEEP_HOURS = Number(process.env.MCP_EXPORT_KEEP_HOURS ?? 72);

/** Thư mục chứa font/logo/ảnh minh hoạ/hình nền (bản sao của public/ trong image). */
const ASSET_DIR = process.env.PDF_ASSET_DIR ?? path.resolve(process.cwd(), "public");
const asset = (p: string) => path.join(ASSET_DIR, p);

let assetsReady = false;
export function useLocalAssets() {
  if (assetsReady) return;
  pdfAssets.font400 = asset("fonts/be-vietnam-pro-400.ttf");
  pdfAssets.font600 = asset("fonts/be-vietnam-pro-600.ttf");
  pdfAssets.nameFonts = Object.fromEntries(
    Object.entries(pdfAssets.nameFonts).map(([id, [a, b]]) => [id, [asset(a.replace(/^\//, "")), asset(b.replace(/^\//, ""))] as [string, string]]),
  );
  pdfAssets.logo = asset("icons/app-icon-192.png");
  pdfAssets.avatarM = asset("avatars/male-royal.png");
  pdfAssets.avatarF = asset("avatars/female-royal.png");
  pdfAssets.watermarks = { phoenix: asset("watermarks/phoenix.png"), dragon: asset("watermarks/dragon.png") };
  assetsReady = true;
}

/**
 * Dựng PDF từ một lần dàn trang duy nhất.
 *
 * Mục lục cần số trang của các mục phía sau, mà react-pdf chỉ cho biết số trang của CHÍNH phần tử đang dàn. Cách cũ:
 * dựng CẢ cuốn hai lượt (lượt một chỉ để lấy số trang) — tốn gấp đôi thời gian, mà dàn trang chiếm ~87% thời gian dựng.
 * Cách này:
 *   1. dàn trang cả cuốn MỘT lần → tiêu đề từng mục ghi số trang vào `pageRegistry`;
 *   2. dàn lại RIÊNG trang mục lục (một tài liệu nhỏ: trang đệm + mục lục) với số trang thật — rất rẻ;
 *   3. thay trang mục lục trong kết quả dàn trang ở bước 1 bằng trang vừa dàn, rồi mới ghi PDF.
 * Trang mục lục không đổi số trang giữa hai bản (cùng danh sách mục, chỉ khác vài chữ số trong cột rộng cố định)
 * nên số trang các mục còn lại không lệch. Không khớp dự kiến (không tìm thấy trang mục lục ở vị trí 2) thì dựng
 * hai lượt như cũ — chậm hơn nhưng luôn đúng.
 */
type Layout = { children: Array<{ children?: unknown[]; type?: string; value?: string }> };
const layoutFn = layoutDocument as unknown as (doc: unknown, fonts: unknown) => Promise<Layout>;

const hasText = (node: unknown, text: string): boolean => {
  const n = node as { value?: string; children?: unknown[] };
  if (n.value === text) return true;
  return (n.children ?? []).some((c) => hasText(c, text));
};

async function renderWithToc(doc: (extra?: { tocPages?: Record<string, number>; tocOnly?: boolean }) => React.ReactElement): Promise<Buffer> {
  resetPageRegistry();
  const main = reactPdf(doc()) as unknown as { container: { document: { props?: Record<string, unknown> } } };
  const layout = await layoutFn(main.container.document, Font);

  const tocIdx = layout.children.findIndex((p) => hasText(p, "Mục lục"));
  if (tocIdx !== 1) {
    // Không đúng bố cục dự kiến → lượt hai đầy đủ (an toàn).
    return renderToBuffer(doc({ tocPages: { ...pageRegistry } }));
  }
  const tocInstance = reactPdf(doc({ tocPages: { ...pageRegistry }, tocOnly: true })) as unknown as { container: { document: unknown } };
  const tocLayout = await layoutFn(tocInstance.container.document, Font);
  const tocPage = tocLayout.children[1];
  if (!tocPage || !hasText(tocPage, "Mục lục")) return renderToBuffer(doc({ tocPages: { ...pageRegistry } }));
  layout.children[tocIdx] = tocPage;

  const props = main.container.document.props ?? {};
  const ctx = new PDFDocument({
    compress: true,
    pdfVersion: props.pdfVersion as never,
    lang: props.language as never,
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
  } as never);
  const stream = (renderPDF as unknown as (c: unknown, l: unknown) => NodeJS.ReadableStream)(ctx, layout);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (c: Buffer | Uint8Array) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

/** Một sổ một lúc: dựng PDF ngốn bộ nhớ, máy web chỉ ~2 GB và còn chạy cả FE. */
let busy = false;

export async function photoDataUris(db: SupabaseClient, items: { id: string; path: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (items.length === 0) return out;
  const paths = [...new Set(items.map((i) => i.path))];
  const urlOf = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await db.storage.from("person-photos").createSignedUrls(paths.slice(i, i + 100), 600);
    for (const r of data ?? []) if (r.path && r.signedUrl) urlOf.set(r.path, r.signedUrl);
  }
  const queue = [...items];
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const url = urlOf.get(it.path);
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        out.set(it.id, `data:image/jpeg;base64,${buf.toString("base64")}`);
      } catch {
        /* ảnh lỗi: thẻ dùng avatar mặc định, không bỏ cả cuốn sổ vì một ảnh */
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return out;
}

const WATERMARKS = ["phoenix", "dragon", "none"] as const;

export async function exportClanBook(c: Ctx, a: Record<string, unknown>): Promise<string> {
  const bool = (k: string, d: boolean) => (typeof a[k] === "boolean" ? (a[k] as boolean) : d);
  const wm = a.watermark === undefined ? "phoenix" : String(a.watermark);
  if (!(WATERMARKS as readonly string[]).includes(wm)) throw new UserError(`watermark phải là: ${WATERMARKS.join(", ")}.`);
  if (a.tree_per_page !== undefined && (!Number.isInteger(a.tree_per_page) || (a.tree_per_page as number) < 4 || (a.tree_per_page as number) > 60)) {
    throw new UserError("tree_per_page phải là số nguyên 4–60.");
  }

  const clan = await getClanDetail(c.clanId, c.userId, c.db as never);
  if (!clan) throw new UserError("Không đọc được dòng họ.");
  const { count } = await c.db.from("persons").select("id", { count: "exact", head: true }).eq("clan_id", c.clanId).is("deleted_at", null);
  if ((count ?? 0) > MAX_PERSONS) throw new UserError(`Dòng họ có ${count} người, vượt trần ${MAX_PERSONS} của việc xuất qua MCP. Xuất trong app.`);

  const opts = {
    tree: bool("tree", true),
    folderTree: bool("folder_tree", true),
    detail: bool("detail", true),
    treePerPage: a.tree_per_page as number | undefined,
    treeSinglePage: bool("tree_single_page", true),
    watermark: wm === "none" ? undefined : (wm as "phoenix" | "dragon"),
  };

  // ── Cache: dữ liệu sổ không đổi thì trả lại file đã dựng, khỏi dàn trang lại (dàn trang là phần tốn nhất).
  // Khoá cache = băm của MỌI thứ ảnh hưởng nội dung sổ: dữ liệu sổ (người, quan hệ, chi, mộ phần, di sản, công đức,
  // văn bản sổ), thông tin dòng họ, tuỳ chọn xuất, mã dựng sổ, và mốc cập nhật từng người (đổi ảnh đại diện giữ
  // nguyên đường dẫn nhưng làm đổi `updated_at`). Việc đọc dữ liệu rẻ hơn dựng sổ hàng chục lần.
  const data = await getClanBookData(c.clanId, c.db as never);
  const { data: stamps } = await c.db.from("persons").select("id, updated_at").eq("clan_id", c.clanId).is("deleted_at", null).order("id").range(0, 9999);
  const { myRole: _r, isPlatformAdmin: _p, ...clanStable } = clan as unknown as Record<string, unknown>;
  const fp = createHash("sha256")
    .update(JSON.stringify({ v: LAYOUT_HASH, opts, clan: clanStable, data, stamps: (stamps ?? []).map((x) => `${x.id}@${x.updated_at}`) }))
    .digest("hex")
    .slice(0, 24);
  const safe = clan.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `gia-pha_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const prefix = `mcp-${c.clanId}-`;
  const objectName = `${prefix}${fp}.pdf`;
  const objectPath = `${c.userId}/${objectName}`;
  const mins = Math.round(LINK_TTL_SECONDS / 60);
  const store = (await c.fresh()).storage.from(BUCKET);

  const sign = async (db: SupabaseClient) => {
    const signed = await db.storage.from(BUCKET).createSignedUrl(objectPath, LINK_TTL_SECONDS, { download: filename });
    if (signed.error || !signed.data?.signedUrl) throw new UserError(`Không tạo được link tải: ${signed.error?.message ?? "lỗi không rõ"}`);
    return signed.data.signedUrl;
  };

  const { data: existing } = await store.list(c.userId, { search: objectName, limit: 5 });
  const hit = (existing ?? []).find((f) => f.name === objectName);
  if (hit) {
    const url = await sign(await c.fresh());
    const kb = (hit.metadata as { size?: number } | null)?.size;
    return [
      `Dữ liệu dòng họ "${clan.name}" không đổi kể từ lần dựng trước nên dùng lại bản đã dựng sẵn${kb ? ` (${(kb / 1024 / 1024).toFixed(1)} MB)` : ""}.`,
      `Link tải (hết hạn sau ${mins} phút, chỉ tải được khi có link này): ${url}`,
      `File tạm tự bị dọn sau ${KEEP_HOURS} giờ không dùng; có thay đổi dữ liệu thì lần gọi sau sẽ dựng bản mới.`,
    ].join("\n");
  }

  if (busy) throw new UserError("Đang dựng một cuốn sổ khác, thử lại sau ít phút.");
  busy = true;
  const started = Date.now();
  try {
    useLocalAssets();
    const photoByPersonId = await photoDataUris(c.db, data.persons.filter((p) => p.photo_path).map((p) => ({ id: p.id, path: p.photo_path as string })));
    const doc = (extra: { tocPages?: Record<string, number>; tocOnly?: boolean } = {}) => (
      <ClanBookPdf
        clan={clan}
        data={data}
        include={opts}
        photoByPersonId={photoByPersonId}
        coverByItemId={new Map()}
        coverQrDataUri={undefined}
        tocPages={extra.tocPages}
        tocOnly={extra.tocOnly}
      />
    );
    const pdf = await renderWithToc(doc);

    const db2 = await c.fresh(); // dựng sổ có thể mất cả phút: JWT ban đầu (2 phút) có thể đã hết hạn
    const up = await db2.storage.from(BUCKET).upload(objectPath, pdf, { upsert: true, contentType: "application/pdf", cacheControl: "60" });
    if (up.error) throw new UserError(`Không lưu được file: ${up.error.message}`);
    // Giữ vài bản gần nhất của dòng họ này: link đã cấp (30 phút) cho một bản cũ không chết ngay khi có bản mới.
    // Bản cũ hơn nữa bị xoá ở đây; phần còn lại do sweepExports dọn theo thời gian.
    const { data: olds } = await db2.storage.from(BUCKET).list(c.userId, { search: `mcp-${c.clanId}`, limit: 100 });
    const stale = (olds ?? [])
      .filter((f) => f.name.startsWith(`mcp-${c.clanId}`) && f.name !== objectName)
      .sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at)))
      .slice(KEEP_VERSIONS - 1) // bản vừa dựng đã tính là một trong KEEP_VERSIONS
      .map((f) => `${c.userId}/${f.name}`);
    if (stale.length) await db2.storage.from(BUCKET).remove(stale);

    const url = await sign(db2);
    return [
      `Đã dựng sổ gia phả "${clan.name}" (${data.persons.length} người, ${(pdf.length / 1024 / 1024).toFixed(1)} MB, ${Math.round((Date.now() - started) / 1000)} giây).`,
      `Link tải (hết hạn sau ${mins} phút, chỉ tải được khi có link này): ${url}`,
      `File tạm tự bị dọn sau ${KEEP_HOURS} giờ không dùng; dữ liệu không đổi thì lần gọi sau dùng lại bản này ngay.`,
    ].join("\n");
  } finally {
    busy = false;
  }
}

/** Dọn file sổ tạm quá hạn trong bucket (chạy định kỳ bằng service role). Trả số file đã xoá. */
export async function sweepExports(admin: SupabaseClient): Promise<number> {
  const cutoff = Date.now() - KEEP_HOURS * 3600_000;
  let removed = 0;
  const { data: dirs } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
  for (const dir of dirs ?? []) {
    if (dir.id) continue; // chỉ thư mục (id người dùng); bỏ qua file lẻ ở gốc
    const { data: files } = await admin.storage.from(BUCKET).list(dir.name, { limit: 1000 });
    const old = (files ?? []).filter((f) => f.name.startsWith("mcp-") && f.updated_at && new Date(f.updated_at).getTime() < cutoff).map((f) => `${dir.name}/${f.name}`);
    if (old.length) {
      const { error } = await admin.storage.from(BUCKET).remove(old);
      if (!error) removed += old.length;
    }
  }
  return removed;
}
