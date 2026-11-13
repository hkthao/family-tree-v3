import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FormActions } from "@/components/ui/form-actions";
import { SidePanel } from "@/components/SidePanel";
import { Fab } from "@/components/Fab";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconAward,
  IconCalendar,
  IconCheck,
  IconPencil,
  IconSearch,
  IconTag,
  IconTrash,
  IconUser,
  IconUsers,
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
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { useAuth } from "@/hooks/useAuth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
  useSearchBox,
  useUrlFilter,
} from "@/hooks/useClientPaging";
import { unaccent } from "@/lib/unaccent";
import {
  createHonorEntry,
  deleteHonorEntry,
  HONOR_CATEGORY_LABEL,
  listHonorEntries,
  updateHonorEntry,
  type HonorCategory,
  type HonorEntry,
} from "@/lib/queries/honor";

import { t } from "@lingui/core/macro";
const CATEGORIES: HonorCategory[] = [
  "donation_money",
  "donation_labor",
  "academic",
  "other",
];

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

/** Trạng thái ngăn kéo: thêm mới, xem (chỉ đọc) hoặc sửa một ghi nhận. */
type PanelState =
  { mode: "new" } | { mode: "view" | "edit"; entry: HonorEntry } | null;

/** Màu + icon chip theo loại ghi nhận. */
const CAT_STYLE: Record<
  HonorCategory,
  { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }
> = {
  donation_money: { tone: "warning", icon: IconWallet },
  donation_labor: { tone: "primary", icon: IconUsers },
  academic: { tone: "success", icon: IconAward },
  other: { tone: "neutral", icon: IconTag },
};

export default function HonorBook() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const canEdit = canEditClan(clan);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  // Ngăn kéo: thêm mới / xem (chỉ đọc) / sửa. Bấm dòng = xem; "Sửa" mới mở form sửa.
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);

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

  // Từ khoá tìm nằm trên URL (?q=) nên bấm Back vẫn giữ nguyên.
  const {
    q: search,
    text: searchText,
    setText: setSearchText,
  } = useSearchBox();
  const [catFilter, setCatFilter] = useUrlFilter<HonorCategory | "">(
    "loai",
    "",
  );
  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return entries.filter(
      (e) =>
        (!catFilter || e.category === catFilter) &&
        (!q ||
          unaccent(`${e.honoree_name} ${e.note ?? ""}`)
            .toLowerCase()
            .includes(q)),
    );
  }, [entries, search, catFilter]);
  const paging = useClientPaging(filtered, 20);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["honor", clan.id] });

  const delM = useMutation({
    mutationFn: (id: string) => deleteHonorEntry(id),
    onSuccess: () => {
      invalidate();
      closePanel();
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Bảng vàng công đức` },
        ]}
      />
      <PageHeader
        icon={<IconAward className="h-7 w-7" />}
        title={t`Bảng vàng công đức`}
        description={t`Vinh danh tấm lòng đóng góp & thành tích của con cháu dòng họ.`}
        actionsBelow
        actions={
          canEdit ? (
            <Fab
              onClick={() => setPanel({ mode: "new" })}
              label={t`Ghi công đức`}
            />
          ) : undefined
        }
      />

      {/* Tổng công đức bằng tiền */}
      {totalMoney > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t`Tổng công đức bằng tiền`}
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatVnd(totalMoney)}
          </p>
        </div>
      )}

      <SidePanel
        open={panel !== null}
        title={
          panel?.mode === "new"
            ? t`Ghi công đức`
            : panel?.mode === "edit"
              ? t`Sửa công đức`
              : t`Công đức`
        }
        subtitle={
          panel?.mode === "new"
            ? t`Vinh danh đóng góp hoặc thành tích của con cháu dòng họ.`
            : undefined
        }
        onClose={closePanel}
        guard={panel?.mode !== "view"}
      >
        {panel && (
          <HonorForm
            key={
              panel.mode === "new" ? "new" : `${panel.mode}-${panel.entry.id}`
            }
            clanId={clan.id}
            entry={panel.mode === "new" ? null : panel.entry}
            readOnly={panel.mode === "view"}
            canEdit={canEdit}
            onSaved={() => {
              closePanel();
              invalidate();
            }}
            onCancel={() =>
              setPanel(
                panel.mode === "edit"
                  ? { mode: "view", entry: panel.entry }
                  : null,
              )
            }
            onEdit={() =>
              panel.mode === "view" &&
              setPanel({ mode: "edit", entry: panel.entry })
            }
            onDelete={
              panel.mode === "edit"
                ? async () => {
                    const ok = await confirm({
                      title: t`Xoá ghi nhận của "${panel.entry.honoree_name}"?`,
                      confirmLabel: t`Xoá`,
                      destructive: true,
                    });
                    if (ok) delM.mutate(panel.entry.id);
                  }
                : undefined
            }
          />
        )}
      </SidePanel>

      {/* Loại ghi nhận nằm trong ngăn kéo bên phải (phễu trong ô tìm kiếm) — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={catFilter ? 1 : 0}
        onReset={() => {
          paging.patchAndResetPage({ loai: null });
        }}
        title={t`Lọc công đức`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm công đức`}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            placeholder={t`Tìm theo tên người, ghi chú…`}
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value as HonorCategory | "");
            }}
            aria-label={t`Lọc theo loại`}
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">{t`Mọi loại`}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {HONOR_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <EmptyState
          icon={<IconAward className="h-10 w-10" />}
          title={t`Chưa có ghi nhận công đức`}
          description={
            canEdit
              ? t`Bấm nút '+' để vinh danh người đóng góp đầu tiên.`
              : t`Trưởng họ sẽ cập nhật khi có đóng góp.`
          }
        />
      )}

      {!isLoading && entries.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={t`Không có ghi nhận nào khớp`}
          description={t`Thử bỏ bớt bộ lọc hoặc từ khoá.`}
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((e) => (
            <HonorRow
              key={e.id}
              entry={e}
              onOpen={() => setPanel({ mode: "view", entry: e })}
            />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit={t`ghi nhận`}
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}
    </div>
  );
}

function HonorRow({
  entry,
  onOpen,
}: {
  entry: HonorEntry;
  onOpen: () => void;
}) {
  const style = CAT_STYLE[entry.category];
  const CatIcon = style.icon;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={style.icon} tone={style.tone} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{entry.honoree_name}</p>
          {entry.note && (
            <p className="mt-0.5 text-sm text-muted-foreground">{entry.note}</p>
          )}
          {entry.occurred_on && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entry.occurred_on.split("-").reverse().join("/")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={style.tone} icon={<CatIcon />}>
              {HONOR_CATEGORY_LABEL[entry.category]}
            </Chip>
            {entry.amount != null && (
              <Chip tone="warning" icon={<IconWallet />}>
                {formatVnd(entry.amount)}
              </Chip>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function HonorForm({
  clanId,
  entry,
  readOnly,
  canEdit,
  onSaved,
  onCancel,
  onEdit,
  onDelete,
}: {
  clanId: string;
  /** null = thêm mới. */
  entry: HonorEntry | null;
  readOnly: boolean;
  canEdit: boolean;
  onSaved: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(entry?.honoree_name ?? "");
  const [category, setCategory] = useState<HonorCategory>(
    entry?.category ?? "donation_money",
  );
  const [amount, setAmount] = useState(
    entry?.amount != null ? String(entry.amount) : "",
  );
  const [occurredOn, setOccurredOn] = useState(entry?.occurred_on ?? "");
  const [note, setNote] = useState(entry?.note ?? "");

  const createM = useMutation({
    mutationFn: () => {
      const payload = {
        honoree_name: name.trim(),
        category,
        amount:
          category === "donation_money" && amount
            ? Math.round(Number(amount))
            : null,
        occurred_on: occurredOn || null,
        note: note.trim() || null,
      };
      return entry
        ? updateHonorEntry(entry.id, payload)
        : createHonorEntry(clanId, payload);
    },
    onSuccess: () => {
      toast.success(entry ? t`Đã cập nhật.` : t`Đã ghi công đức.`);
      onSaved();
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  const canSubmit = name.trim().length > 0 && !createM.isPending;

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
        <div className="space-y-1.5">
          <Label htmlFor="honor-name" required>
            {t`Người được vinh danh`}
          </Label>
          <Input
            id="honor-name"
            icon={<IconUser />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t`Vd: Ông Lê Văn A, hoặc cháu Lê Thị B`}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="honor-cat">{t`Loại`}</Label>
            <Select
              id="honor-cat"
              icon={<IconTag />}
              value={category}
              onChange={(e) => setCategory(e.target.value as HonorCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {HONOR_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          {category === "donation_money" && (
            <div className="space-y-1.5">
              <Label htmlFor="honor-amount">{t`Số tiền (đ)`}</Label>
              <Input
                id="honor-amount"
                icon={<IconWallet />}
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
            <Label htmlFor="honor-date">{t`Ngày (tuỳ chọn)`}</Label>
            <Input
              id="honor-date"
              icon={<IconCalendar />}
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="honor-note">{t`Ghi chú (tuỳ chọn)`}</Label>
          <Textarea
            id="honor-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t`Vd: Ủng hộ xây từ đường / Đỗ Đại học Bách Khoa`}
          />
        </div>
      </fieldset>
      {readOnly ? (
        canEdit && (
          <FormActions>
            <Button type="button" onClick={onEdit}>
              <IconPencil className="mr-1.5 h-4 w-4" />
              {t`Sửa`}
            </Button>
          </FormActions>
        )
      ) : (
        <FormActions>
          {onDelete && (
            <Button
              type="button"
              variant="destructive-outline"
              onClick={onDelete}
            >
              <IconTrash className="mr-1.5 h-4 w-4" />
              {t`Xoá`}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            {t`Hủy`}
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            <IconCheck className="mr-1.5 h-4 w-4" />
            {createM.isPending ? t`Đang lưu…` : t`Lưu`}
          </Button>
        </FormActions>
      )}
    </form>
  );
}
