import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FormActions } from "@/components/ui/form-actions";
import { SidePanel } from "@/components/SidePanel";
import { Fab } from "@/components/Fab";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconCalendar,
  IconCheck,
  IconDownload,
  IconPencil,
  IconSearch,
  IconTag,
  IconTrash,
  IconUpload,
  IconWallet,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging, useSearchBox, useUrlFilter } from "@/hooks/useClientPaging";
import { unaccent } from "@/lib/unaccent";
import {
  createFundTransaction,
  deleteFundTransaction,
  listFundAudit,
  listFundTransactions,
  summarizeFund,
  updateFundTransaction,
  type FundDirection,
  type FundTransaction,
} from "@/lib/queries/clanFund";

/** Trạng thái ngăn kéo: thêm mới, xem (chỉ đọc) hoặc sửa một giao dịch. */
type PanelState =
  | { mode: "new" }
  | { mode: "view" | "edit"; tx: FundTransaction }
  | null;

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
  // Ngăn kéo: thêm mới / xem (chỉ đọc) / sửa. Bấm dòng = xem; "Sửa" mới mở form sửa.
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);
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

  // Từ khoá tìm nằm trên URL (?q=) nên bấm Back vẫn giữ nguyên.
  const { q: search, text: searchText, setText: setSearchText } = useSearchBox();
  const [dirFilter, setDirFilter] = useUrlFilter<FundDirection | "">("dir", "");
  const [fundFilter, setFundFilter] = useUrlFilter<string>("quy", "");
  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return txs.filter(
      (t) =>
        (!dirFilter || t.direction === dirFilter) &&
        (!fundFilter || t.fund === fundFilter) &&
        (!q || unaccent(`${t.fund} ${t.category ?? ""} ${t.note ?? ""} ${t.amount}`).toLowerCase().includes(q)),
    );
  }, [txs, search, dirFilter, fundFilter]);
  const paging = useClientPaging(filtered, 20);

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
    onSuccess: () => {
      invalidate();
      closePanel();
    },
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
              <Fab onClick={() => setPanel({ mode: "new" })} label="Ghi giao dịch" />
            )}
          </div>
        }
      />

      {/* Số dư + tổng thu/chi */}
      <div className="rounded-xl border bg-card shadow-sm p-4">
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

      <SidePanel
        open={panel !== null}
        title={
          panel?.mode === "new"
            ? "Ghi giao dịch"
            : panel?.mode === "edit"
              ? "Sửa giao dịch"
              : "Giao dịch"
        }
        subtitle={panel?.mode === "new" ? "Khoản thu / chi của quỹ họ." : undefined}
        onClose={closePanel}
        guard={panel?.mode !== "view"}
      >
        {panel && (
          <FundForm
            key={panel.mode === "new" ? "new" : `${panel.mode}-${panel.tx.id}`}
            clanId={clan.id}
            tx={panel.mode === "new" ? null : panel.tx}
            readOnly={panel.mode === "view"}
            canEdit={canEdit}
            knownFunds={summary.byFund.map((f) => f.fund)}
            onSaved={() => {
              closePanel();
              invalidate();
            }}
            onCancel={() => setPanel(panel.mode === "edit" ? { mode: "view", tx: panel.tx } : null)}
            onEdit={() => panel.mode === "view" && setPanel({ mode: "edit", tx: panel.tx })}
            onDelete={
              panel.mode === "edit"
                ? async () => {
                    const ok = await confirm({
                      title: `Xoá giao dịch ${formatVnd(panel.tx.amount)}?`,
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) delM.mutate(panel.tx.id);
                  }
                : undefined
            }
          />
        )}
      </SidePanel>

      {/* Thu/chi và quỹ nằm trong ngăn kéo bên phải (phễu trong ô tìm kiếm) — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={(dirFilter ? 1 : 0) + (fundFilter ? 1 : 0)}
        onReset={() => {
          paging.patchAndResetPage({ dir: null, quy: null });
        }}
        title="Lọc giao dịch"
        search={(toggle) => (
          <SearchInput
            label="Tìm giao dịch"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            placeholder="Tìm theo quỹ, mục đích, ghi chú, số tiền…"
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={dirFilter}
            onChange={(e) => {
              setDirFilter(e.target.value as FundDirection | "");
            }}
            aria-label="Lọc thu / chi"
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">Cả thu và chi</option>
            <option value="in">Chỉ khoản thu</option>
            <option value="out">Chỉ khoản chi</option>
          </Select>
          <Select
            value={fundFilter}
            onChange={(e) => {
              setFundFilter(e.target.value);
            }}
            aria-label="Lọc theo quỹ"
            icon={<IconWallet />}
            className="h-11 w-full text-base"
          >
            <option value="">Mọi quỹ</option>
            {summary.byFund.map((f) => (
              <option key={f.fund} value={f.fund}>
                {f.fund}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {!isLoading && txs.length === 0 && (
        <EmptyState
          icon={<IconWallet className="h-10 w-10" />}
          title="Chưa có giao dịch"
          description={
            canEdit
              ? "Bấm nút '+' để ghi khoản thu/chi đầu tiên."
              : "Thủ quỹ/trưởng họ sẽ cập nhật thu chi tại đây."
          }
        />
      )}

      {!isLoading && txs.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title="Không có giao dịch nào khớp"
          description="Thử bỏ bớt bộ lọc hoặc từ khoá."
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((t) => (
            <FundRow key={t.id} tx={t} onOpen={() => setPanel({ mode: "view", tx: t })} />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="giao dịch"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
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

function FundRow({ tx, onOpen }: { tx: FundTransaction; onOpen: () => void }) {
  const isIn = tx.direction === "in";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={isIn ? IconDownload : IconUpload} tone={isIn ? "success" : "danger"} />
        <div className="min-w-0 flex-1">
          <p
            className={`text-base font-semibold tabular-nums ${
              isIn ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            }`}
          >
            {isIn ? "+" : "−"}
            {formatVnd(tx.amount)}
          </p>
          {tx.note && (
            <p className="mt-0.5 text-sm text-muted-foreground">{tx.note}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tx.occurred_on.split("-").reverse().join("/")}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={isIn ? "success" : "danger"} icon={isIn ? <IconDownload /> : <IconUpload />}>
              {isIn ? "Thu" : "Chi"}
            </Chip>
            <Chip tone="teal" icon={<IconWallet />}>
              {tx.fund}
            </Chip>
            {tx.category && (
              <Chip tone="violet" icon={<IconTag />}>
                {tx.category}
              </Chip>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function FundForm({
  clanId,
  tx,
  readOnly,
  canEdit,
  knownFunds,
  onSaved,
  onCancel,
  onEdit,
  onDelete,
}: {
  clanId: string;
  /** null = thêm mới. */
  tx: FundTransaction | null;
  readOnly: boolean;
  canEdit: boolean;
  knownFunds: string[];
  onSaved: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [direction, setDirection] = useState<FundDirection>(tx?.direction ?? "in");
  const [amount, setAmount] = useState(tx ? String(tx.amount) : "");
  const [fund, setFund] = useState(tx?.fund ?? knownFunds[0] ?? "Quỹ chung");
  const [category, setCategory] = useState(tx?.category ?? "");
  const [occurredOn, setOccurredOn] = useState(tx?.occurred_on ?? "");
  const [note, setNote] = useState(tx?.note ?? "");

  const createM = useMutation({
    mutationFn: () => {
      const input = {
        direction,
        amount: Math.round(Number(amount)),
        fund: fund.trim() || "Quỹ chung",
        category: category.trim() || null,
        occurred_on: occurredOn || null,
        note: note.trim() || null,
      };
      return tx ? updateFundTransaction(tx.id, input) : createFundTransaction(clanId, input);
    },
    onSuccess: () => {
      toast.success(tx ? "Đã cập nhật giao dịch." : "Đã ghi giao dịch.");
      onSaved();
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
      className="space-y-3"
    >
      <fieldset
        disabled={readOnly}
        className={`m-0 min-w-0 space-y-3 border-0 p-0 ${readOnly ? "[&_:disabled]:!cursor-default [&_:disabled]:!opacity-100" : ""}`}
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
      <div className="space-y-1.5">
        <Label htmlFor="fund-note">Ghi chú (tuỳ chọn)</Label>
        <Textarea
          id="fund-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Người đóng góp / chi tiết khoản chi…"
        />
      </div>
      </fieldset>
      {readOnly ? (
        canEdit && (
          <FormActions>
            <Button type="button" onClick={onEdit}>
              <IconPencil className="mr-1.5 h-4 w-4" />
              Sửa
            </Button>
          </FormActions>
        )
      ) : (
        <FormActions>
          {onDelete && (
            <Button type="button" variant="destructive-outline" onClick={onDelete}>
              <IconTrash className="mr-1.5 h-4 w-4" />
              Xoá
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            <IconCheck className="mr-1.5 h-4 w-4" />
            {createM.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </FormActions>
      )}
    </form>
  );
}
