import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import {
  IconCalendar,
  IconCheck,
  IconDownload,
  IconPlus,
  IconScroll,
  IconTag,
  IconTrash,
  IconWallet,
  IconX,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  createFundTransaction,
  deleteFundTransaction,
  listFundAudit,
  listFundTransactions,
  summarizeFund,
  type FundDirection,
  type FundTransaction,
} from "@/lib/queries/clanFund";

const AUDIT_ACTION_LABEL: Record<"insert" | "update" | "delete", string> = {
  insert: "Thêm",
  update: "Sửa",
  delete: "Xoá",
};

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

export default function ClanFund() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const canEdit = canEditClan(clan);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["clan-fund", clan.id, user?.id ?? ""],
    queryFn: () => listFundTransactions(clan.id),
    enabled: !!user?.id,
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["clan-fund-audit", clan.id],
    queryFn: () => listFundAudit(clan.id),
    enabled: showAudit && !!user?.id,
  });
  const summary = useMemo(() => summarizeFund(txs), [txs]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["clan-fund", clan.id] });

  // Xuất báo cáo Quỹ họ ra PDF (chia sẻ cho cả họ). Dynamic-import để không
  // kéo @react-pdf vào bundle khi chưa dùng.
  const onExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { downloadFundReportPdf } = await import(
        "@/lib/pdf/exportFundReport"
      );
      await downloadFundReportPdf(clan);
      toast.success("Đã xuất báo cáo Quỹ họ (PDF).");
    } catch (e) {
      toast.error("Không xuất được PDF", {
        description: (e as Error).message,
      });
    } finally {
      setExporting(false);
    }
  };

  const delM = useMutation({
    mutationFn: (id: string) => deleteFundTransaction(id),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[{ label: clan.name, to: `/clans/${clan.id}` }, { label: "Quỹ họ" }]}
      />
      <PageHeader
        icon={<IconWallet className="h-7 w-7" />}
        title="Quỹ họ"
        description="Sổ thu/chi minh bạch — mọi thành viên đều xem được."
        actionsBelow
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onExportPdf}
              disabled={exporting || txs.length === 0}
            >
              <IconDownload className="mr-1 h-4 w-4" />
              {exporting ? "Đang xuất…" : "Xuất PDF"}
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
                {showAdd ? (
                  <>
                    <IconX className="mr-1 h-4 w-4" />
                    Đóng
                  </>
                ) : (
                  <>
                    <IconPlus className="mr-1 h-4 w-4" />
                    Ghi giao dịch
                  </>
                )}
              </Button>
            )}
          </div>
        }
      />

      {/* Số dư + tổng thu/chi */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Số dư hiện tại
        </p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          }`}
        >
          {formatVnd(summary.balance)}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Tổng thu: </span>
            <b className="text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatVnd(summary.totalIn)}
            </b>
          </span>
          <span>
            <span className="text-muted-foreground">Tổng chi: </span>
            <b className="text-destructive tabular-nums">
              {formatVnd(summary.totalOut)}
            </b>
          </span>
        </div>
        {summary.byFund.length > 1 && (
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            {summary.byFund.map((f) => (
              <div key={f.fund} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">{f.fund}</span>
                <b className="shrink-0 tabular-nums">{formatVnd(f.balance)}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit && showAdd && (
        <AddFundForm
          clanId={clan.id}
          knownFunds={summary.byFund.map((f) => f.fund)}
          onDone={() => {
            setShowAdd(false);
            invalidate();
          }}
        />
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {!isLoading && txs.length === 0 && (
        <EmptyState
          icon={<IconWallet className="h-10 w-10" />}
          title="Chưa có giao dịch"
          description={
            canEdit
              ? 'Bấm "+ Ghi giao dịch" để ghi khoản thu/chi đầu tiên.'
              : "Thủ quỹ/trưởng họ sẽ cập nhật thu chi tại đây."
          }
        />
      )}

      {txs.length > 0 && (
        <ul className="space-y-2">
          {txs.map((t) => (
            <FundRow
              key={t.id}
              tx={t}
              canEdit={canEdit}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Xoá giao dịch ${formatVnd(t.amount)}?`,
                  confirmLabel: "Xoá",
                  destructive: true,
                });
                if (ok) delM.mutate(t.id);
              }}
            />
          ))}
        </ul>
      )}

      {/* Nhật ký thay đổi — minh bạch ai thêm/sửa/xoá khi nào. */}
      <div className="border-t pt-3">
        <button
          type="button"
          onClick={() => setShowAudit((v) => !v)}
          className="text-sm text-primary hover:underline"
        >
          {showAudit ? "Ẩn" : "Xem"} nhật ký thay đổi
        </button>
        {showAudit && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {audit.length === 0 && <li>Chưa có thay đổi nào được ghi.</li>}
            {audit.map((a) => (
              <li key={a.id}>
                <b className="text-foreground">{AUDIT_ACTION_LABEL[a.action]}</b>
                {a.amount != null ? ` ${formatVnd(a.amount)}` : ""}
                {a.fund ? ` · ${a.fund}` : ""} — {a.actor_name ?? "—"} ·{" "}
                {new Date(a.at).toLocaleString("vi-VN")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FundRow({
  tx,
  canEdit,
  onDelete,
}: {
  tx: FundTransaction;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const isIn = tx.direction === "in";
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`text-base font-semibold tabular-nums ${
              isIn ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            }`}
          >
            {isIn ? "+" : "−"}
            {formatVnd(tx.amount)}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tx.fund}
          </span>
        </div>
        {tx.category && <p className="mt-0.5 text-sm">{tx.category}</p>}
        {tx.note && (
          <p className="mt-0.5 text-sm text-muted-foreground">{tx.note}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tx.occurred_on.split("-").reverse().join("/")}
        </p>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Xoá"
          title="Xoá"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function AddFundForm({
  clanId,
  knownFunds,
  onDone,
}: {
  clanId: string;
  knownFunds: string[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [direction, setDirection] = useState<FundDirection>("in");
  const [amount, setAmount] = useState("");
  const [fund, setFund] = useState(knownFunds[0] ?? "Quỹ chung");
  const [category, setCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [note, setNote] = useState("");

  const createM = useMutation({
    mutationFn: () =>
      createFundTransaction(clanId, {
        direction,
        amount: Math.round(Number(amount)),
        fund: fund.trim() || "Quỹ chung",
        category: category.trim() || null,
        occurred_on: occurredOn || null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Đã ghi giao dịch.");
      onDone();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const amountOk = Number(amount) > 0;
  const canSubmit = amountOk && !createM.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) createM.mutate();
      }}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <SegmentedControl ariaLabel="Loại giao dịch" className="w-full">
        <SegmentedButton
          active={direction === "in"}
          onClick={() => setDirection("in")}
          className="flex-1 px-3"
        >
          Thu (đóng góp)
        </SegmentedButton>
        <SegmentedButton
          active={direction === "out"}
          onClick={() => setDirection("out")}
          className="flex-1 px-3"
        >
          Chi
        </SegmentedButton>
      </SegmentedControl>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fund-amount" required>
            Số tiền (đ)
          </Label>
          <Input
            id="fund-amount"
            icon={<IconWallet />}
            type="number"
            inputMode="numeric"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Vd: 500000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fund-name">Quỹ</Label>
          <Input
            id="fund-name"
            icon={<IconWallet />}
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            list="fund-list"
            placeholder="Quỹ chung"
          />
          <datalist id="fund-list">
            {knownFunds.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fund-cat">Mục đích (tuỳ chọn)</Label>
          <Input
            id="fund-cat"
            icon={<IconTag />}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Vd: Đóng góp giỗ tổ / Mua vật liệu"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fund-date">Ngày (tuỳ chọn)</Label>
          <Input
            id="fund-date"
            icon={<IconCalendar />}
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fund-note">Ghi chú (tuỳ chọn)</Label>
        <Input
          id="fund-note"
          icon={<IconScroll />}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Người đóng góp / chi tiết khoản chi…"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <IconCheck className="mr-1.5 h-4 w-4" />
          {createM.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </form>
  );
}
