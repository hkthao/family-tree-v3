import { useState } from "react";

import { BOOK_WATERMARKS, type BookWatermarkId } from "@/lib/pdf/bookWatermarks";
import { getClanDetail } from "@/lib/queries/clan-detail";
import type { ClanSummary } from "@/lib/queries/clans";

import { openPdf as open, preparePdfAssets, savePdf } from "../pdf";
import { toast } from "../toast";

/**
 * Xuất Sổ gia phả PDF.
 *
 * Dựng sổ bằng ĐÚNG mã của bản web (`buildClanBookPdf`) nên cuốn sổ ra
 * giống hệt. Khác ở khâu trả file: trong Zalo không tải kiểu trình duyệt
 * được, nên file được đẩy lên kho riêng tư `book-exports` rồi mở bằng
 * trình xem tài liệu của Zalo (có nút tải về) qua một địa chỉ có chữ ký,
 * hết hạn sau một giờ.
 *
 * Bộ dựng PDF nặng (~1,5MB) nên chỉ nạp khi người dùng bấm "Tạo sổ".
 */
type Phase =
  | { kind: "idle" }
  | { kind: "working"; text: string }
  | { kind: "done"; url: string; filename: string; mb: string }
  | { kind: "error"; message: string };

export function ExportBookScreen({ clan, userId }: { clan: ClanSummary; userId: string }) {
  const [singlePage, setSinglePage] = useState(true);
  const [folderTree, setFolderTree] = useState(true);
  const [watermark, setWatermark] = useState<BookWatermarkId | "">("phoenix");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const run = async () => {
    try {
      setPhase({ kind: "working", text: "Đang lấy dữ liệu dòng họ…" });
      const detail = await getClanDetail(clan.id, userId);
      if (!detail) throw new Error("Không đọc được thông tin dòng họ.");

      const [{ buildClanBookPdf }] = await Promise.all([import("@/lib/pdf/exportClanBook"), preparePdfAssets()]);

      setPhase({ kind: "working", text: "Đang dựng sổ… (họ đông người có thể mất một lúc)" });
      const { blob, filename } = await buildClanBookPdf(detail, {
        tree: true,
        detail: true,
        treeSinglePage: singlePage,
        folderTree,
        watermark: watermark || null,
        // Mã QR ở bìa phải trỏ về trang web, không phải địa chỉ của Zalo.
        shareOrigin: "https://giapha.thaohk.com",
      });

      setPhase({ kind: "working", text: "Đang lưu sổ…" });
      // Một file cố định cho mỗi dòng họ, ghi đè mỗi lần xuất.
      const url = await savePdf(blob, userId, clan.id, filename);

      const done = { kind: "done" as const, url, filename, mb: (blob.size / 1024 / 1024).toFixed(1) };
      setPhase(done);
      toast("Đã tạo sổ gia phả");
      void open(done.url, done.filename);
    } catch (e) {
      const message = (e as Error).message;
      setPhase({ kind: "error", message });
      toast(message, "error");
    }
  };

  const busy = phase.kind === "working";

  return (
    <div className="page">
      <p className="crumb">Sổ gia phả của <b>{clan.name}</b></p>

      <section className="card pane">
        <h3 className="serif">Tuỳ chọn</h3>
        <div className="fgroup">
          <span className="lbl">Trang sơ đồ cây</span>
          <div className="seg full" style={{ margin: "4px 0 0" }} role="group" aria-label="Trang sơ đồ cây">
            <button type="button" aria-pressed={singlePage} disabled={busy} onClick={() => setSinglePage(true)}>Một trang lớn</button>
            <button type="button" aria-pressed={!singlePage} disabled={busy} onClick={() => setSinglePage(false)}>Nhiều trang A4</button>
          </div>
          <p className="note">
            {singlePage
              ? "Cả sơ đồ liền trên một trang khổ lớn — hợp để xem trên máy."
              : "Tách theo đời thành nhiều trang A4 — hợp để in."}
          </p>
        </div>
        <label className="fgroup frow">
          <span className="lbl" style={{ margin: 0 }}>Kèm trang cây dạng thư mục</span>
          <input type="checkbox" role="switch" className="switch" checked={folderTree} disabled={busy} onChange={(e) => setFolderTree(e.target.checked)} />
        </label>
        <div className="fgroup">
          <span className="lbl">Hình nền mờ</span>
          <div className="seg full" style={{ margin: "4px 0 0" }} role="group" aria-label="Hình nền mờ">
            <button type="button" aria-pressed={watermark === ""} disabled={busy} onClick={() => setWatermark("")}>Không</button>
            {(Object.keys(BOOK_WATERMARKS) as BookWatermarkId[]).map((id) => (
              <button key={id} type="button" aria-pressed={watermark === id} disabled={busy} onClick={() => setWatermark(id)}>
                {BOOK_WATERMARKS[id].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {phase.kind === "working" && (
        <section className="card pane">
          <div className="sk" style={{ height: 6, borderRadius: 3, marginBottom: 10 }} />
          <p className="muted" style={{ margin: 0 }}>{phase.text}</p>
          <p className="note">Giữ màn hình này mở cho tới khi xong.</p>
        </section>
      )}

      {phase.kind === "done" && (
        <section className="card pane">
          <b style={{ display: "block" }}>Sổ đã sẵn sàng</b>
          <p className="note" style={{ marginTop: 2 }}>{phase.filename} · {phase.mb} MB. Địa chỉ mở sổ có hiệu lực trong 1 giờ.</p>
          <button type="button" className="btn block" style={{ marginTop: 10 }} onClick={() => open(phase.url, phase.filename)}>
            Mở sổ PDF
          </button>
        </section>
      )}

      {phase.kind === "error" && <p className="error">{phase.message}</p>}

      <div className="cta">
        <button type="button" className="btn block" disabled={busy} onClick={run}>
          {busy ? "Đang tạo sổ…" : phase.kind === "done" ? "Tạo lại sổ" : "Tạo sổ PDF"}
        </button>
      </div>
    </div>
  );
}
