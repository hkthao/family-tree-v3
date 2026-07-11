import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { IconAward, IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { useAuth } from "@/hooks/useAuth";
import {
  createHonorEntry,
  deleteHonorEntry,
  HONOR_CATEGORY_LABEL,
  listHonorEntries,
  type HonorCategory,
  type HonorEntry,
} from "@/lib/queries/honor";

const CATEGORIES: HonorCategory[] = [
  "donation_money",
  "donation_labor",
  "academic",
  "other",
];

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

const CAT_TONE: Record<HonorCategory, string> = {
  donation_money: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  donation_labor: "bg-primary/10 text-primary",
  academic: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  other: "bg-muted text-muted-foreground",
};

export default function HonorBook() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const canEdit = canEditClan(clan);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["honor", clan.id, user?.id ?? ""],
    queryFn: () => listHonorEntries(clan.id),
    enabled: !!user?.id,
  });

  const totalMoney = useMemo(
    () =>
      entries
        .filter((e) => e.category === "donation_money" && e.amount)
        .reduce((s, e) => s + (e.amount ?? 0), 0),
    [entries],
  );

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["honor", clan.id] });

  const delM = useMutation({
    mutationFn: (id: string) => deleteHonorEntry(id),
    onSuccess: invalidate,
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Sổ vàng công đức" },
        ]}
      />
      <PageHeader
        icon={<IconAward className="h-7 w-7" />}
        title="Sổ vàng công đức"
        description="Vinh danh tấm lòng đóng góp & thành tích của con cháu dòng họ."
        actionsBelow
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Đóng" : "+ Ghi công đức"}
            </Button>
          ) : undefined
        }
      />

      {/* Tổng công đức bằng tiền */}
      {totalMoney > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Tổng công đức bằng tiền
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatVnd(totalMoney)}
          </p>
        </div>
      )}

      {canEdit && showAdd && (
        <AddHonorForm
          clanId={clan.id}
          onDone={() => {
            setShowAdd(false);
            invalidate();
          }}
        />
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {!isLoading && entries.length === 0 && (
        <EmptyState
          icon={<IconAward className="h-10 w-10" />}
          title="Chưa có ghi nhận công đức"
          description={
            canEdit
              ? 'Bấm "+ Ghi công đức" để vinh danh người đóng góp đầu tiên.'
              : "Trưởng họ sẽ cập nhật khi có đóng góp."
          }
        />
      )}

      {entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((e) => (
            <HonorRow
              key={e.id}
              entry={e}
              canEdit={canEdit}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Xoá ghi nhận của "${e.honoree_name}"?`,
                  confirmLabel: "Xoá",
                  destructive: true,
                });
                if (ok) delM.mutate(e.id);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HonorRow({
  entry,
  canEdit,
  onDelete,
}: {
  entry: HonorEntry;
  canEdit: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{entry.honoree_name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_TONE[entry.category]}`}
          >
            {HONOR_CATEGORY_LABEL[entry.category]}
          </span>
          {entry.amount != null && (
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatVnd(entry.amount)}
            </span>
          )}
        </div>
        {entry.note && (
          <p className="mt-0.5 text-sm text-muted-foreground">{entry.note}</p>
        )}
        {entry.occurred_on && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.occurred_on.split("-").reverse().join("/")}
          </p>
        )}
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

function AddHonorForm({
  clanId,
  onDone,
}: {
  clanId: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HonorCategory>("donation_money");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [note, setNote] = useState("");

  const createM = useMutation({
    mutationFn: () =>
      createHonorEntry(clanId, {
        honoree_name: name.trim(),
        category,
        amount:
          category === "donation_money" && amount
            ? Math.round(Number(amount))
            : null,
        occurred_on: occurredOn || null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Đã ghi công đức.");
      onDone();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const canSubmit = name.trim().length > 0 && !createM.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) createM.mutate();
      }}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="honor-name" required>
          Người được vinh danh
        </Label>
        <Input
          id="honor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vd: Ông Lê Văn A, hoặc cháu Lê Thị B"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="honor-cat">Loại</Label>
          <select
            id="honor-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as HonorCategory)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {HONOR_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        {category === "donation_money" && (
          <div className="space-y-1.5">
            <Label htmlFor="honor-amount">Số tiền (đ)</Label>
            <Input
              id="honor-amount"
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Vd: 2000000"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="honor-date">Ngày (tuỳ chọn)</Label>
          <Input
            id="honor-date"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="honor-note">Ghi chú (tuỳ chọn)</Label>
        <Input
          id="honor-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vd: Ủng hộ xây từ đường / Đỗ Đại học Bách Khoa"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {createM.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </form>
  );
}
