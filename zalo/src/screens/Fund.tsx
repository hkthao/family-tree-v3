import { useMemo, useState, type FormEvent } from "react";

import { IconDownload, IconPlus, IconTrash, IconWallet } from "@/components/icons";
import { getClanDetail } from "@/lib/queries/clan-detail";
import type { ClanSummary } from "@/lib/queries/clans";
import {
  createFundTransaction,
  deleteFundTransaction,
  listFundAudit,
  listFundTransactions,
  summarizeFund,
  type FundDirection,
  type FundTransaction,
} from "@/lib/queries/clanFund";

import { openPdf, preparePdfAssets, savePdf } from "../pdf";
import { useRev } from "../rev";
import { toast } from "../toast";
import { useAsync } from "../useAsync";

/**
 * Quỹ họ — CÙNG CHỨC NĂNG với trang /fund của web: số dư (tổng và từng
 * quỹ), sổ thu/chi, ghi giao dịch, xoá, nhật ký thay đổi, xuất báo cáo PDF.
 * Dùng nguyên `@/lib/queries/clanFund` và bộ dựng PDF của web; quyền ghi do
 * máy chủ kiểm.
 *
 * PDF mở bằng trình xem tài liệu của Zalo (xem `../pdf`) thay vì tải về.
 */
const AUDIT_ACTION_LABEL: Record<"insert" | "update" | "delete", string> = {
  insert: "Thêm",
  update: "Sửa",
  delete: "Xoá",
};

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " đ";

function AddForm({ clanId, knownFunds, onDone }: { clanId: string; knownFunds: string[]; onDone: () => void }) {
  const [direction, setDirection] = useState<FundDirection>("in");
  const [amount, setAmount] = useState("");
  const [fund, setFund] = useState(knownFunds[0] ?? "Quỹ chung");
  const [category, setCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = Number(amount) > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    try {
      await createFundTransaction(clanId, {
        direction,
        amount: Math.round(Number(amount)),
        fund: fund.trim() || "Quỹ chung",
        category: category.trim() || null,
        occurred_on: occurredOn || null,
        note: note.trim() || null,
      });
      toast("Đã ghi giao dịch");
      onDone();
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, ph: string, extra?: { list?: string; type?: string; mode?: "numeric" }) => (
    <div className="fgroup">
      <label className="lbl">
        {label}
        <input className="field" style={{ marginTop: 4 }} value={value} placeholder={ph} list={extra?.list} type={extra?.type} inputMode={extra?.mode} onChange={(e) => set(e.target.value)} />
      </label>
    </div>
  );

  return (
    <form className="card pane" onSubmit={submit}>
      <div className="seg full" role="group" aria-label="Loại giao dịch">
        <button type="button" aria-pressed={direction === "in"} onClick={() => setDirection("in")}>Thu (đóng góp)</button>
        <button type="button" aria-pressed={direction === "out"} onClick={() => setDirection("out")}>Chi</button>
      </div>
      {field("Số tiền (đ)", amount, (v) => setAmount(v.replace(/\D/g, "")), "Vd: 500000", { mode: "numeric" })}
      {Number(amount) > 0 && <p className="note" style={{ margin: "-4px 0 8px" }}>{vnd(Number(amount))}</p>}
      {field("Quỹ", fund, setFund, "Quỹ chung", { list: "fund-list" })}
      <datalist id="fund-list">{knownFunds.map((f) => <option key={f} value={f} />)}</datalist>
      {field("Mục đích (tuỳ chọn)", category, setCategory, "Vd: Đóng góp giỗ tổ / Mua vật liệu")}
      {field("Ngày (tuỳ chọn)", occurredOn, setOccurredOn, "", { type: "date" })}
      {field("Ghi chú (tuỳ chọn)", note, setNote, "Người đóng góp / chi tiết khoản chi…")}
      <button type="submit" className="btn block" disabled={!ok || busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
    </form>
  );
}

export function FundScreen({ clan, userId, canEdit }: { clan: ClanSummary; userId: string; canEdit: boolean }) {
  const rev = useRev();
  const [bump, setBump] = useState(0);
  const txs = useAsync(() => listFundTransactions(clan.id), [clan.id, rev, bump]);
  const list = useMemo(() => txs.data ?? [], [txs.data]);
  const summary = useMemo(() => summarizeFund(list), [list]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const audit = useAsync(() => (showAudit ? listFundAudit(clan.id) : Promise.resolve([])), [clan.id, showAudit, bump]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const remove = async (t: FundTransaction) => {
    setBusy(true);
    try {
      await deleteFundTransaction(t.id);
      toast("Đã xoá giao dịch");
      setConfirming(null);
      setBump((n) => n + 1);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const detail = await getClanDetail(clan.id, userId);
      if (!detail) throw new Error("Không đọc được thông tin dòng họ.");
      const [{ buildFundReportPdf }] = await Promise.all([import("@/lib/pdf/exportFundReport"), preparePdfAssets()]);
      const { blob, filename } = await buildFundReportPdf(detail);
      const url = await savePdf(blob, userId, `quy-ho-${clan.id}`, filename);
      toast("Đã xuất báo cáo Quỹ họ");
      await openPdf(url, filename);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>Sổ thu/chi minh bạch — mọi thành viên đều xem được.</p>

      <section className="card pane">
        <span className="tiny" style={{ margin: 0, textTransform: "uppercase", letterSpacing: ".04em" }}>Số dư hiện tại</span>
        <div className={`fund-balance ${summary.balance >= 0 ? "pos" : "neg"}`}>{vnd(summary.balance)}</div>
        <div className="fund-totals">
          <span>Tổng thu: <b className="pos">{vnd(summary.totalIn)}</b></span>
          <span>Tổng chi: <b className="neg">{vnd(summary.totalOut)}</b></span>
        </div>
        {summary.byFund.length > 1 && (
          <div className="fund-byfund">
            {summary.byFund.map((f) => (
              <div key={f.fund}>
                <span className="ell">{f.fund}</span>
                <b>{vnd(f.balance)}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 8, margin: "0 0 10px" }}>
        <button type="button" className="btn ghost" style={{ flex: 1 }} disabled={exporting || list.length === 0} onClick={exportPdf}>
          <IconDownload /> {exporting ? "Đang xuất…" : "Xuất PDF"}
        </button>
        {canEdit && (
          <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Đóng" : <><IconPlus /> Ghi giao dịch</>}
          </button>
        )}
      </div>

      {canEdit && showAdd && (
        <AddForm
          clanId={clan.id}
          knownFunds={summary.byFund.map((f) => f.fund)}
          onDone={() => {
            setShowAdd(false);
            setBump((n) => n + 1);
          }}
        />
      )}

      {txs.loading && !txs.data && <div className="sk" style={{ height: 200 }} />}
      {txs.error && <p className="error">{txs.error}</p>}
      {txs.data && list.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconWallet /></div>
          <p className="muted">
            {canEdit ? "Chưa có giao dịch. Bấm “Ghi giao dịch” để ghi khoản thu/chi đầu tiên." : "Chưa có giao dịch. Thủ quỹ/trưởng họ sẽ cập nhật thu chi tại đây."}
          </p>
        </div>
      )}

      {list.length > 0 && (
        <div className="card group">
          {list.map((t) => {
            const isIn = t.direction === "in";
            return (
              <div key={t.id} className="grow fund-row">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <b className={isIn ? "pos" : "neg"}>{isIn ? "+" : "−"}{vnd(t.amount)}</b>
                    <span className="chip" style={{ marginLeft: 6 }}>{t.fund}</span>
                    {t.category && <span style={{ display: "block", fontSize: 14, marginTop: 2 }}>{t.category}</span>}
                    {t.note && <span className="tiny" style={{ margin: "2px 0 0" }}>{t.note}</span>}
                    <span className="tiny" style={{ margin: "2px 0 0" }}>{t.occurred_on.split("-").reverse().join("/")}</span>
                  </span>
                  {canEdit && confirming !== t.id && (
                    <button type="button" className="btn text dangertext sm" aria-label="Xoá" onClick={() => setConfirming(t.id)}>
                      <IconTrash />
                    </button>
                  )}
                </div>
                {confirming === t.id && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn neutral" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirming(null)}>Huỷ</button>
                    <button type="button" className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => remove(t)}>
                      Xoá {vnd(t.amount)}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nhật ký thay đổi — minh bạch ai thêm/sửa/xoá khi nào. */}
      <button type="button" className="btn text block" style={{ marginTop: 10 }} onClick={() => setShowAudit((v) => !v)}>
        {showAudit ? "Ẩn" : "Xem"} nhật ký thay đổi
      </button>
      {showAudit && (
        <div className="card pane">
          {audit.loading && <div className="sk" style={{ height: 60 }} />}
          {audit.data && audit.data.length === 0 && <p className="note" style={{ margin: 0 }}>Chưa có thay đổi nào được ghi.</p>}
          {(audit.data ?? []).map((a) => (
            <p key={a.id} className="note" style={{ margin: "0 0 6px" }}>
              <b style={{ color: "var(--ink)" }}>{AUDIT_ACTION_LABEL[a.action]}</b>
              {a.amount != null ? ` ${vnd(a.amount)}` : ""}
              {a.fund ? ` · ${a.fund}` : ""} — {a.actor_name ?? "—"} · {new Date(a.at).toLocaleString("vi-VN")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
