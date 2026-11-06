import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconMapPin,
  IconSearch,
  IconX,
  IconTag,
  IconTrash,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions } from "@/components/ui/form-actions";
import { Select } from "@/components/ui/select";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import {
  VN_REGION_LABEL,
  VN_WARD_KIND_LABEL,
  countWardsByProvince,
  deleteProvince,
  deleteProvinces,
  deleteWard,
  deleteWards,
  listProvinces,
  listWards,
  saveProvince,
  saveWard,
  type VnProvince,
  type VnRegion,
  type VnWard,
  type VnWardKind,
} from "@/lib/queries/vnDivisions";
import { AdminShell } from "@/pages/admin/AdminShell";

type Tab = "provinces" | "wards";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const WARD_PAGE_SIZE_DEFAULT = 50;
const PROVINCE_PAGE_SIZE_DEFAULT = 20;

/**
 * Danh mục địa giới (tỉnh/thành → xã/phường, hệ 2 cấp từ 01/07/2025).
 * Là nguồn cho ô chọn "Nơi ở hiện tại" của thành viên và bản đồ thống kê.
 * Sửa/thêm mở trong ngăn kéo phải (xem docs/plan-side-panel-ux.md).
 */
export default function DanhMucDiaGioiPage() {
  const [tab, setTab] = useState<Tab>("provinces");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<VnRegion | "">("");
  const [provinceCode, setProvinceCode] = useState("");
  const [kind, setKind] = useState<VnWardKind | "">("");
  const provinces = useProvinces().data ?? [];
  const isProvinces = tab === "provinces";

  return (
    <AdminShell
      icon={<IconMapPin className="h-7 w-7" />}
      title="Danh mục địa giới"
      description="Tỉnh/thành và xã/phường dùng cho ô chọn địa chỉ của thành viên."
    >
      {/* Chọn danh mục (Tỉnh/Thành hay Xã/Phường) và các bộ lọc nằm trong ngăn kéo
          bên phải (phễu trong ô tìm kiếm); trang chỉ còn một danh sách. */}
      <CollapsibleFilters
        activeCount={isProvinces ? (region ? 1 : 0) : (provinceCode ? 1 : 0) + (kind ? 1 : 0)}
        onReset={() => {
          setRegion("");
          setProvinceCode("");
          setKind("");
        }}
        title="Bộ lọc danh mục"
        search={(toggle) => (
          <SearchInput
            label={isProvinces ? "Tìm tỉnh/thành" : "Tìm xã/phường"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Gõ có dấu hoặc không dấu"
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <fieldset className="space-y-2">
            <legend className="text-base font-medium">Danh mục</legend>
            <div role="tablist" className="flex gap-2">
              {(
                [
                  ["provinces", "Tỉnh / Thành"],
                  ["wards", "Xã / Phường"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`min-h-[44px] flex-1 rounded-md border px-3 text-sm ${
                    tab === value
                      ? "border-primary bg-primary/5 font-medium"
                      : "hover:bg-muted/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {isProvinces ? (
            <>
              <Label htmlFor="prov-filter-region">Vùng miền</Label>
              <Select
                id="prov-filter-region"
                icon={<IconMapPin />}
                value={region}
                onChange={(e) => setRegion(e.target.value as VnRegion | "")}
                className="h-11 w-full text-base"
              >
                <option value="">Mọi vùng</option>
                {(Object.keys(VN_REGION_LABEL) as VnRegion[]).map((r) => (
                  <option key={r} value={r}>
                    {VN_REGION_LABEL[r]}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <>
              <Label htmlFor="ward-prov">Tỉnh/thành</Label>
              <Select
                id="ward-prov"
                icon={<IconMapPin />}
                value={provinceCode}
                onChange={(e) => setProvinceCode(e.target.value)}
                className="h-11 w-full text-base"
              >
                <option value="">Tất cả tỉnh/thành</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Label htmlFor="ward-kind-filter">Loại đơn vị</Label>
              <Select
                id="ward-kind-filter"
                icon={<IconTag />}
                value={kind}
                onChange={(e) => setKind(e.target.value as VnWardKind | "")}
                className="h-11 w-full text-base"
              >
                <option value="">Xã, phường, đặc khu</option>
                {(Object.keys(VN_WARD_KIND_LABEL) as VnWardKind[]).map((k) => (
                  <option key={k} value={k}>
                    {VN_WARD_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      </CollapsibleFilters>

      {isProvinces ? (
        <ProvincesTab search={search} region={region} />
      ) : (
        <WardsTab search={search} provinceCode={provinceCode} kind={kind} />
      )}
    </AdminShell>
  );
}

function useProvinces() {
  return useQuery({
    queryKey: queryKeys.vnProvinces(),
    queryFn: () => listProvinces(),
    staleTime: 5 * 60_000,
  });
}

/** Một dòng danh mục — cùng kiểu dòng của Danh bạ: thẻ chung chia vạch, tick để chọn nhiều, bấm dòng để sửa. */
function DivisionRow({
  title,
  meta,
  selected,
  onToggleSelect,
  onClick,
}: {
  title: string;
  meta: string;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  return (
    <li className="relative flex items-start gap-2">
      <label className="cursor-pointer pl-3 pt-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 accent-primary"
          aria-label={`Chọn ${title}`}
        />
      </label>
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start p-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{meta}</span>
        </span>
      </button>
    </li>
  );
}

/** Hàng đầu danh sách: tick chọn cả trang. */
function SelectPageRow({
  count,
  allSelected,
  onToggle,
}: {
  count: number;
  allSelected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-x-3 bg-muted/30 px-3 py-2">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Chọn cả trang này ({count})
      </label>
    </li>
  );
}

/** Thanh hành động khi đã chọn ≥ 1 dòng. */
function SelectionBar({
  count,
  unit,
  busy,
  onDelete,
  onClear,
}: {
  count: number;
  unit: string;
  busy: boolean;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
      <span className="mr-1 font-medium">
        Đã chọn {count} {unit}
      </span>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onDelete}>
        <IconTrash className="mr-1.5 h-4 w-4" />
        {busy ? "Đang xoá…" : "Xoá đã chọn"}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClear}>
        <IconX className="mr-1.5 h-4 w-4" />
        Bỏ chọn
      </Button>
    </div>
  );
}

function toggleInSet(prev: Set<string>, code: string): Set<string> {
  const next = new Set(prev);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  return next;
}

function LoadingBox() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-muted-foreground">Đang tải…</p>
    </div>
  );
}

// ───────────── Tỉnh / Thành ─────────────────────────────────────────

function ProvincesTab({ search, region }: { search: string; region: VnRegion | "" }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const provincesQ = useProvinces();
  const countsQ = useQuery({
    queryKey: queryKeys.vnWardCounts(),
    queryFn: () => countWardsByProvince(),
    staleTime: 60_000,
  });
  const [editing, setEditing] = useState<VnProvince | "new" | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.vnProvinces() });
    qc.invalidateQueries({ queryKey: queryKeys.vnWardCounts() });
  };

  const deleteM = useMutation({
    mutationFn: (code: string) => deleteProvince(code),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Đã xoá tỉnh/thành");
    },
    onError: (e) =>
      toast.error("Không xoá được", {
        description: /foreign key|violates/i.test((e as Error).message)
          ? "Tỉnh này còn xã/phường hoặc đang được dùng trong địa chỉ thành viên."
          : (e as Error).message,
      }),
  });

  const bulkDeleteM = useMutation({
    mutationFn: (codes: string[]) => deleteProvinces(codes),
    onSuccess: ({ deleted, failed }) => {
      refresh();
      setSelected(new Set());
      if (deleted) toast.success(`Đã xoá ${deleted} tỉnh/thành`);
      if (failed)
        toast.error(`Không xoá được ${failed} tỉnh/thành`, {
          description: "Tỉnh còn xã/phường hoặc đang được dùng trong địa chỉ thành viên.",
        });
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const all = provincesQ.data ?? [];
  const term = unaccent(search.trim()).toLowerCase();
  const filtered = all.filter(
    (p) =>
      (!region || p.region === region) &&
      (!term || unaccent(p.name).toLowerCase().includes(term)),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PROVINCE_PAGE_SIZE_DEFAULT);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Đổi tìm kiếm/bộ lọc/số dòng làm tổng giảm → kẹp lại cho khỏi đứng ở trang không còn.
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => setPage(1), [search, region, pageSize]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [safePage, search, region, pageSize]);
  return (
    <section className="space-y-3">
      <Fab onClick={() => setEditing("new")} label="Thêm tỉnh/thành" />

      {provincesQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(provincesQ.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          unit="tỉnh/thành"
          busy={bulkDeleteM.isPending}
          onClear={() => setSelected(new Set())}
          onDelete={async () => {
            const ok = await confirm({
              title: `Xoá ${selected.size} tỉnh/thành đã chọn?`,
              description:
                "Chỉ xoá được tỉnh không còn xã/phường và chưa ai dùng làm địa chỉ. Tỉnh bị chặn sẽ được giữ lại.",
              confirmLabel: "Xoá",
              destructive: true,
            });
            if (ok) bulkDeleteM.mutate([...selected]);
          }}
        />
      )}

      {provincesQ.isLoading ? (
        <LoadingBox />
      ) : filtered.length === 0 ? (
        all.length > 0 ? (
          <EmptyState
            icon={<IconSearch className="h-10 w-10" />}
            title="Không có tỉnh/thành nào khớp"
            description="Thử bỏ bớt bộ lọc hoặc từ khoá."
          />
        ) : (
          <EmptyState
            icon={<IconMapPin className="h-10 w-10" />}
            title="Chưa có tỉnh/thành nào"
            description='Bấm nút "+" để thêm tỉnh/thành.'
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          <SelectPageRow
            count={rows.length}
            allSelected={rows.length > 0 && rows.every((r) => selected.has(r.code))}
            onToggle={(checked) =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const r of rows) {
                  if (checked) next.add(r.code);
                  else next.delete(r.code);
                }
                return next;
              })
            }
          />
          {rows.map((p) => (
            <DivisionRow
              key={p.code}
              title={p.name}
              meta={`Mã ${p.code} · ${VN_REGION_LABEL[p.region]} · ${countsQ.data?.[p.code] ?? 0} xã/phường`}
              selected={selected.has(p.code)}
              onToggleSelect={() => setSelected((prev) => toggleInSet(prev, p.code))}
              onClick={() => setEditing(p)}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={pageSize}
        unit="tỉnh/thành"
        onPageChange={setPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />

      <SidePanel
        open={editing !== null}
        title={editing === "new" ? "Thêm tỉnh/thành" : "Sửa tỉnh/thành"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ProvinceForm
            row={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onDelete={
              editing === "new"
                ? undefined
                : async () => {
                    const ok = await confirm({
                      title: `Xoá "${editing.name}"?`,
                      description:
                        "Chỉ xoá được khi tỉnh không còn xã/phường và chưa ai dùng làm địa chỉ.",
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) deleteM.mutate(editing.code);
                  }
            }
            onSaved={() => {
              refresh();
              setEditing(null);
            }}
          />
        )}
      </SidePanel>
    </section>
  );
}

function ProvinceForm({
  row,
  onSaved,
  onCancel,
  onDelete,
}: {
  row: VnProvince | null;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [region, setRegion] = useState<VnRegion>(row?.region ?? "bac");

  const saveM = useMutation({
    mutationFn: () => saveProvince({ code, name, region }, !row),
    onSuccess: () => {
      toast.success(row ? "Đã cập nhật" : "Đã thêm");
      onSaved();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && name.trim()) saveM.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="prov-code" required>
          Mã
        </Label>
        <Input
          id="prov-code"
          icon={<IconTag />}
          required
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={!!row}
        />
        {row && (
          <p className="text-xs text-muted-foreground">
            Mã không đổi được vì địa chỉ thành viên đang tham chiếu tới mã này.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-name" required>
          Tên
        </Label>
        <Input
          id="prov-name"
          icon={<IconMapPin />}
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-region" required>
          Vùng miền
        </Label>
        <Select
          id="prov-region"
          value={region}
          onChange={(e) => setRegion(e.target.value as VnRegion)}
        >
          {(Object.keys(VN_REGION_LABEL) as VnRegion[]).map((r) => (
            <option key={r} value={r}>
              {VN_REGION_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>
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
        <Button
          type="submit"
          disabled={saveM.isPending || !code.trim() || !name.trim()}
        >
          <IconCheck className="mr-1.5 h-4 w-4" />
          {saveM.isPending ? "Đang lưu…" : row ? "Cập nhật" : "Thêm"}
        </Button>
      </FormActions>
    </form>
  );
}

// ───────────── Xã / Phường ──────────────────────────────────────────

function WardsTab({
  search: searchInput,
  provinceCode,
  kind,
}: {
  search: string;
  provinceCode: string;
  kind: VnWardKind | "";
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const provincesQ = useProvinces();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(WARD_PAGE_SIZE_DEFAULT);
  const [editing, setEditing] = useState<VnWard | "new" | null>(null);

  // Gõ xong mới truy vấn — danh mục có ~3.300 dòng.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // Đổi bộ lọc thì về trang đầu.
  useEffect(() => setPage(0), [provinceCode, kind, pageSize]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [page, search, provinceCode, kind, pageSize]);

  const params = { provinceCode: provinceCode || null, kind: kind || null, search, page, pageSize };
  const wardsQ = useQuery({
    queryKey: queryKeys.vnWards(params),
    queryFn: () => listWards(params),
    placeholderData: (prev) => prev,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vn-wards"] });
    qc.invalidateQueries({ queryKey: queryKeys.vnWardCounts() });
  };

  const deleteM = useMutation({
    mutationFn: (code: string) => deleteWard(code),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Đã xoá xã/phường");
    },
    onError: (e) =>
      toast.error("Không xoá được", {
        description: /foreign key|violates/i.test((e as Error).message)
          ? "Đơn vị này đang được dùng trong địa chỉ thành viên."
          : (e as Error).message,
      }),
  });

  const bulkDeleteM = useMutation({
    mutationFn: (codes: string[]) => deleteWards(codes),
    onSuccess: ({ deleted, failed }) => {
      refresh();
      setSelected(new Set());
      if (deleted) toast.success(`Đã xoá ${deleted} xã/phường`);
      if (failed)
        toast.error(`Không xoá được ${failed} xã/phường`, {
          description: "Đơn vị đang được dùng trong địa chỉ thành viên.",
        });
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const provinces = provincesQ.data ?? [];
  const provinceName = (code: string) =>
    provinces.find((p) => p.code === code)?.name ?? code;
  const rows = wardsQ.data?.rows ?? [];
  const total = wardsQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-3">
      {provinces.length > 0 && (
        <Fab onClick={() => setEditing("new")} label="Thêm xã/phường" />
      )}

      {wardsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(wardsQ.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          unit="xã/phường"
          busy={bulkDeleteM.isPending}
          onClear={() => setSelected(new Set())}
          onDelete={async () => {
            const ok = await confirm({
              title: `Xoá ${selected.size} xã/phường đã chọn?`,
              description: "Hành động này không thể hoàn tác. Đơn vị đang được dùng làm địa chỉ sẽ được giữ lại.",
              confirmLabel: "Xoá",
              destructive: true,
            });
            if (ok) bulkDeleteM.mutate([...selected]);
          }}
        />
      )}

      {!wardsQ.data ? (
        <LoadingBox />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title="Không có xã/phường nào khớp"
          description="Thử bỏ bớt bộ lọc hoặc từ khoá."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          <SelectPageRow
            count={rows.length}
            allSelected={rows.length > 0 && rows.every((r) => selected.has(r.code))}
            onToggle={(checked) =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const r of rows) {
                  if (checked) next.add(r.code);
                  else next.delete(r.code);
                }
                return next;
              })
            }
          />
          {rows.map((w) => (
            <DivisionRow
              key={w.code}
              title={`${VN_WARD_KIND_LABEL[w.kind]} ${w.name}`}
              meta={`Mã ${w.code} · ${provinceName(w.province_code)}`}
              selected={selected.has(w.code)}
              onToggleSelect={() => setSelected((prev) => toggleInSet(prev, w.code))}
              onClick={() => setEditing(w)}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page + 1}
        totalPages={pageCount}
        total={total}
        pageSize={pageSize}
        unit="xã/phường"
        isFetching={wardsQ.isFetching}
        onPageChange={(p) => setPage(p - 1)}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />

      <SidePanel
        open={editing !== null}
        title={editing === "new" ? "Thêm xã/phường" : "Sửa xã/phường"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <WardForm
            row={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onDelete={
              editing === "new"
                ? undefined
                : async () => {
                    const ok = await confirm({
                      title: `Xoá "${editing.name}"?`,
                      description: "Hành động này không thể hoàn tác.",
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) deleteM.mutate(editing.code);
                  }
            }
            provinces={provinces}
            defaultProvince={provinceCode}
            onSaved={() => {
              refresh();
              setEditing(null);
            }}
          />
        )}
      </SidePanel>
    </section>
  );
}

function WardForm({
  row,
  provinces,
  defaultProvince,
  onSaved,
  onCancel,
  onDelete,
}: {
  row: VnWard | null;
  provinces: VnProvince[];
  defaultProvince: string;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [provinceCode, setProvinceCode] = useState(
    row?.province_code ?? (defaultProvince || provinces[0]?.code || ""),
  );
  const [kind, setKind] = useState<VnWardKind>(row?.kind ?? "xa");

  const saveM = useMutation({
    mutationFn: () =>
      saveWard({ code, name, province_code: provinceCode, kind }, !row),
    onSuccess: () => {
      toast.success(row ? "Đã cập nhật" : "Đã thêm");
      onSaved();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && name.trim() && provinceCode) saveM.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ward-code" required>
          Mã
        </Label>
        <Input
          id="ward-code"
          icon={<IconTag />}
          required
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={!!row}
        />
        {row && (
          <p className="text-xs text-muted-foreground">
            Mã không đổi được vì địa chỉ thành viên đang tham chiếu tới mã này.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ward-form-prov" required>
          Tỉnh/thành
        </Label>
        <Select
          id="ward-form-prov"
          value={provinceCode}
          onChange={(e) => setProvinceCode(e.target.value)}
        >
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ward-kind" required>
          Loại
        </Label>
        <Select
          id="ward-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as VnWardKind)}
        >
          {(Object.keys(VN_WARD_KIND_LABEL) as VnWardKind[]).map((k) => (
            <option key={k} value={k}>
              {VN_WARD_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ward-name" required>
          Tên (không kèm "Xã/Phường")
        </Label>
        <Input
          id="ward-name"
          icon={<IconMapPin />}
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
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
        <Button
          type="submit"
          disabled={saveM.isPending || !code.trim() || !name.trim() || !provinceCode}
        >
          <IconCheck className="mr-1.5 h-4 w-4" />
          {saveM.isPending ? "Đang lưu…" : row ? "Cập nhật" : "Thêm"}
        </Button>
      </FormActions>
    </form>
  );
}
