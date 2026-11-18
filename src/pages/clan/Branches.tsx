import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { FilterableSelect } from "@/components/FilterableSelect";
import { IconTile } from "@/components/IconTile";
import {
  IconBuildings,
  IconList,
  IconScroll,
  IconSearch,
  IconTree,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Textarea } from "@/components/ui/textarea";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { useAuth } from "@/hooks/useAuth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
  useSearchBox,
  useUrlFilter,
} from "@/hooks/useClientPaging";
import {
  effectiveRole,
  isClanAdmin,
  useClanContext,
} from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
  type BranchRow,
} from "@/lib/queries/branches";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
import { unaccent } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";

/**
 * Chi (nhánh) của dòng họ — một chức năng riêng ở hub (trước nằm trong trang Sổ gia phả). Theo khuôn màn danh sách:
 * tìm + icon Tuỳ chọn (thứ tự) → danh sách chia vạch → phân trang → nút "+" → ngăn kéo xem → Sửa → form (Xoá trong form).
 * Thành viên xem được; chỉ quản trị dòng họ thêm/sửa/xoá. `?chi=<id>` mở thẳng ngăn kéo (từ tìm kiếm toàn cục).
 */
type PanelState =
  { mode: "new" } | { mode: "view" | "edit"; branch: BranchRow } | null;

export default function Branches() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = isClanAdmin(clan);
  const [panel, setPanel] = useState<PanelState>(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: queryKeys.branches(clan.id, userId),
    queryFn: () => listBranches(clan.id),
    enabled: !!userId,
  });
  // Cây (đã cache dùng chung với màn Cây): đếm số người mỗi chi + danh sách chọn trưởng chi.
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });
  const persons = useMemo(() => tree?.persons ?? [], [tree]);
  const countByBranch = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of persons)
      if (p.branch_id) m.set(p.branch_id, (m.get(p.branch_id) ?? 0) + 1);
    return m;
  }, [persons]);
  const nameById = useMemo(
    () => new Map(persons.map((p) => [p.id, p.full_name] as const)),
    [persons],
  );

  // Mở thẳng một chi (từ tìm kiếm toàn cục: ?chi=<id>).
  const [sp, setSp] = useSearchParams();
  const openId = sp.get("chi");
  useEffect(() => {
    if (!openId || !branches.length) return;
    const b = branches.find((x) => x.id === openId);
    if (b) setPanel({ mode: "view", branch: b });
    const next = new URLSearchParams(sp);
    next.delete("chi");
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, branches]);

  const {
    q: search,
    text: searchText,
    setText: setSearchText,
  } = useSearchBox();
  const [sort, setSort] = useUrlFilter<"name" | "size">("sx", "name");
  const filtered = useMemo(() => {
    const q = unaccent(search.trim());
    const rows = branches.filter(
      (b) =>
        !q ||
        unaccent(
          `${b.name} ${b.ancestral_house ?? ""} ${b.notes ?? ""} ${
            b.head_person_id ? (nameById.get(b.head_person_id) ?? "") : ""
          }`,
        ).includes(q),
    );
    return sort === "size"
      ? [...rows].sort(
          (a, b) =>
            (countByBranch.get(b.id) ?? 0) - (countByBranch.get(a.id) ?? 0),
        )
      : rows;
  }, [branches, search, sort, nameById, countByBranch]);
  const paging = useClientPaging(filtered, 20);

  const delM = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: async () => {
      await invalidateClanData(qc, clan.id);
      setPanel(null);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  if (effectiveRole(clan) === null)
    return <Navigate to={`/clans/${clan.id}`} replace />;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Chi (nhánh)` },
        ]}
      />
      <PageHeader
        icon={<IconTree className="h-7 w-7" />}
        title={t`Chi (nhánh)`}
        description={t`Các chi/nhánh của dòng họ. Mỗi người có thể thuộc một chi.`}
        actionsBelow
        actions={
          canEdit ? (
            <Fab
              onClick={() => setPanel({ mode: "new" })}
              label={t`Thêm chi`}
            />
          ) : undefined
        }
      />

      <CollapsibleFilters
        activeCount={sort !== "name" ? 1 : 0}
        onReset={() => paging.patchAndResetPage({ sx: null })}
        title={t`Tuỳ chọn chi`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm chi`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t`Tìm theo tên chi, trưởng chi, nhà thờ…`}
            rightSlot={toggle}
          />
        )}
      >
        <FilterableSelect
          value={sort}
          onChange={(v) => setSort(v as "name" | "size")}
          icon={<IconList />}
          options={[
            { value: "name", label: t`Tên A → Z` },
            { value: "size", label: t`Đông người nhất` },
          ]}
          emptyLabel={t`Sắp xếp`}
          filterLabel={t`Sắp xếp`}
          className="h-11 text-base"
          required
        />
      </CollapsibleFilters>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}
      {!isLoading && branches.length === 0 && (
        <EmptyState
          icon={<IconTree className="h-10 w-10" />}
          title={t`Chưa có chi nào`}
          description={
            canEdit
              ? t`Bấm nút '+' để thêm chi đầu tiên.`
              : t`Quản trị dòng họ sẽ thêm các chi.`
          }
        />
      )}
      {!isLoading && branches.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={t`Không có chi nào khớp`}
          description={t`Thử bỏ bớt từ khoá.`}
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setPanel({ mode: "view", branch: b })}
                className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
              >
                <IconTile icon={IconTree} tone="primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.name}</span>
                  {b.ancestral_house && (
                    <span className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <IconBuildings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">{b.ancestral_house}</span>
                    </span>
                  )}
                  <span className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {b.head_person_id && nameById.get(b.head_person_id) && (
                      <Chip tone="info" icon={<IconUser />}>
                        {nameById.get(b.head_person_id)}
                      </Chip>
                    )}
                    <Chip tone="neutral" icon={<IconUsers />}>
                      {t`${countByBranch.get(b.id) ?? 0} người`}
                    </Chip>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit={t`chi`}
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={
          panel?.mode === "new"
            ? t`Thêm chi`
            : panel?.mode === "edit"
              ? t`Sửa chi`
              : t`Chi (nhánh)`
        }
        subtitle={panel && panel.mode !== "new" ? panel.branch.name : undefined}
        onClose={() => setPanel(null)}
        guard={panel?.mode !== "view"}
      >
        {panel && (
          <BranchForm
            key={
              panel.mode === "new" ? "new" : `${panel.mode}-${panel.branch.id}`
            }
            clanId={clan.id}
            branch={panel.mode === "new" ? null : panel.branch}
            readOnly={panel.mode === "view"}
            canEdit={canEdit}
            personOptions={persons
              .map((p) => ({ value: p.id, label: p.full_name }))
              .sort((a, b) => a.label.localeCompare(b.label, "vi"))}
            onSaved={async () => {
              await invalidateClanData(qc, clan.id);
              setPanel(null);
            }}
            onCancel={() =>
              setPanel(
                panel.mode === "edit"
                  ? { mode: "view", branch: panel.branch }
                  : null,
              )
            }
            onEdit={() =>
              panel.mode === "view" &&
              setPanel({ mode: "edit", branch: panel.branch })
            }
            onDelete={
              panel.mode === "edit"
                ? async () => {
                    const ok = await confirm({
                      title: t`Xoá chi "${panel.branch.name}"?`,
                      description: t`Các người đang thuộc chi này sẽ không còn chi.`,
                      confirmLabel: t`Xoá`,
                      destructive: true,
                    });
                    if (ok) delM.mutate(panel.branch.id);
                  }
                : undefined
            }
          />
        )}
      </SidePanel>
    </div>
  );
}

function BranchForm({
  clanId,
  branch,
  readOnly,
  canEdit,
  personOptions,
  onSaved,
  onCancel,
  onEdit,
  onDelete,
}: {
  clanId: string;
  branch: BranchRow | null;
  readOnly: boolean;
  canEdit: boolean;
  personOptions: { value: string; label: string }[];
  onSaved: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(branch?.name ?? "");
  const [head, setHead] = useState(branch?.head_person_id ?? "");
  const [house, setHouse] = useState(branch?.ancestral_house ?? "");
  const [notes, setNotes] = useState(branch?.notes ?? "");

  const saveM = useMutation({
    mutationFn: async () => {
      const fields = {
        name: name.trim(),
        head_person_id: head || null,
        ancestral_house: house.trim() || null,
        notes: notes.trim() || null,
      };
      if (branch) await updateBranch(branch.id, fields);
      else await createBranch({ clan_id: clanId, ...fields });
    },
    onSuccess: () => {
      toast.success(branch ? t`Đã lưu chi` : t`Đã thêm chi`, {
        description: name.trim(),
      });
      onSaved();
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) saveM.mutate();
      }}
      className="space-y-3"
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="branch-name" required>
            {t`Tên chi`}
          </Label>
          <Input
            id="branch-name"
            icon={<IconTree />}
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t`Vd: Chi Giáp, Chi trưởng`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="branch-head">{t`Trưởng chi (tuỳ chọn)`}</Label>
          <FilterableSelect
            id="branch-head"
            icon={<IconUser />}
            value={head}
            onChange={setHead}
            options={personOptions}
            emptyLabel={t`Chưa chọn`}
            filterLabel={t`Tìm người`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="branch-house">{t`Nhà thờ chi (tuỳ chọn)`}</Label>
          <Input
            id="branch-house"
            icon={<IconBuildings />}
            maxLength={300}
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            placeholder={t`Tên và địa chỉ nhà thờ của chi`}
          />
        </div>
        <Textarea
          id="branch-notes"
          label={t`Ghi chú (tuỳ chọn)`}
          icon={<IconScroll />}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t`Nguồn gốc, đời tách chi…`}
        />
      </ReadOnlyFieldset>
      <ViewEditActions
        readOnly={readOnly}
        canEdit={canEdit}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={onDelete}
        deleteDisabled={saveM.isPending}
        saving={saveM.isPending}
        canSave={!!name.trim()}
        saveLabel={branch ? t`Lưu` : t`Thêm`}
      />
    </form>
  );
}
