import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { queryKeys } from "@/lib/queries/keys";
import {
  VN_REGION_LABEL,
  VN_WARD_KIND_LABEL,
  WARD_PAGE_SIZE,
  countWardsByProvince,
  deleteProvince,
  deleteWard,
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

/**
 * Danh mục địa giới (tỉnh/thành → xã/phường, hệ 2 cấp từ 01/07/2025).
 * Là nguồn cho ô chọn "Nơi ở hiện tại" của thành viên và bản đồ thống kê.
 * Sửa/thêm mở trong ngăn kéo phải (xem docs/plan-side-panel-ux.md).
 */
export default function DanhMucDiaGioiPage() {
  const [tab, setTab] = useState<Tab>("provinces");
  return (
    <AdminShell
      icon={<IconMapPin className="h-7 w-7" />}
      title="Danh mục địa giới"
      description="Tỉnh/thành và xã/phường dùng cho ô chọn địa chỉ của thành viên."
    >
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
            className={`min-h-[44px] rounded-md border px-4 text-sm ${
              tab === value
                ? "border-primary bg-primary/5 font-medium"
                : "hover:bg-muted/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "provinces" ? <ProvincesTab /> : <WardsTab />}
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

// ───────────── Tỉnh / Thành ─────────────────────────────────────────

function ProvincesTab() {
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
      toast.success("Đã xoá tỉnh/thành");
    },
    onError: (e) =>
      toast.error("Không xoá được", {
        description: /foreign key|violates/i.test((e as Error).message)
          ? "Tỉnh này còn xã/phường hoặc đang được dùng trong địa chỉ thành viên."
          : (e as Error).message,
      }),
  });

  const rows = provincesQ.data ?? [];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tổng <strong>{rows.length}</strong> tỉnh/thành.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <IconPlus className="mr-1.5 h-4 w-4" />
          Thêm tỉnh/thành
        </Button>
      </div>

      {provincesQ.isLoading && <p className="text-muted-foreground">Đang tải…</p>}
      {provincesQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(provincesQ.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!provincesQ.isLoading && rows.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có tỉnh/thành nào. Bấm "Thêm tỉnh/thành" hoặc nhập danh mục có sẵn.
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((p) => (
          <li
            key={p.code}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                Mã {p.code} · {VN_REGION_LABEL[p.region]} ·{" "}
                {countsQ.data?.[p.code] ?? 0} xã/phường
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Sửa ${p.name}`}
              onClick={() => setEditing(p)}
            >
              <IconPencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Xoá ${p.name}`}
              onClick={async () => {
                const ok = await confirm({
                  title: `Xoá "${p.name}"?`,
                  description:
                    "Chỉ xoá được khi tỉnh không còn xã/phường và chưa ai dùng làm địa chỉ.",
                  confirmLabel: "Xoá",
                  destructive: true,
                });
                if (ok) deleteM.mutate(p.code);
              }}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <SidePanel
        open={editing !== null}
        title={editing === "new" ? "Thêm tỉnh/thành" : "Sửa tỉnh/thành"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ProvinceForm
            row={editing === "new" ? null : editing}
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
}: {
  row: VnProvince | null;
  onSaved: () => void;
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
      <Button
        type="submit"
        disabled={saveM.isPending || !code.trim() || !name.trim()}
      >
        <IconCheck className="mr-1.5 h-4 w-4" />
        {saveM.isPending ? "Đang lưu…" : row ? "Cập nhật" : "Thêm"}
      </Button>
    </form>
  );
}

// ───────────── Xã / Phường ──────────────────────────────────────────

function WardsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const provincesQ = useProvinces();
  const [provinceCode, setProvinceCode] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<VnWard | "new" | null>(null);

  // Gõ xong mới truy vấn — danh mục có ~3.300 dòng.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const params = { provinceCode: provinceCode || null, search, page };
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
      toast.success("Đã xoá xã/phường");
    },
    onError: (e) =>
      toast.error("Không xoá được", {
        description: /foreign key|violates/i.test((e as Error).message)
          ? "Đơn vị này đang được dùng trong địa chỉ thành viên."
          : (e as Error).message,
      }),
  });

  const provinces = provincesQ.data ?? [];
  const provinceName = (code: string) =>
    provinces.find((p) => p.code === code)?.name ?? code;
  const rows = wardsQ.data?.rows ?? [];
  const total = wardsQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / WARD_PAGE_SIZE));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="ward-prov">Tỉnh/thành</Label>
          <Select
            id="ward-prov"
            value={provinceCode}
            onChange={(e) => {
              setProvinceCode(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="ward-search">Tìm theo tên</Label>
          <Input
            id="ward-search"
            icon={<IconSearch />}
            placeholder="Gõ có dấu hoặc không dấu"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={provinces.length === 0}
          onClick={() => setEditing("new")}
        >
          <IconPlus className="mr-1.5 h-4 w-4" />
          Thêm xã/phường
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {wardsQ.isLoading ? "Đang tải…" : <>Có <strong>{total}</strong> kết quả.</>}
      </p>
      {wardsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(wardsQ.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <ul className="space-y-2">
        {rows.map((w) => (
          <li
            key={w.code}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {VN_WARD_KIND_LABEL[w.kind]} {w.name}
              </div>
              <div className="text-xs text-muted-foreground">
                Mã {w.code} · {provinceName(w.province_code)}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Sửa ${w.name}`}
              onClick={() => setEditing(w)}
            >
              <IconPencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Xoá ${w.name}`}
              onClick={async () => {
                const ok = await confirm({
                  title: `Xoá "${w.name}"?`,
                  description: "Hành động này không thể hoàn tác.",
                  confirmLabel: "Xoá",
                  destructive: true,
                });
                if (ok) deleteM.mutate(w.code);
              }}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      {total > WARD_PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {page + 1}/{pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}

      <SidePanel
        open={editing !== null}
        title={editing === "new" ? "Thêm xã/phường" : "Sửa xã/phường"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <WardForm
            row={editing === "new" ? null : editing}
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
}: {
  row: VnWard | null;
  provinces: VnProvince[];
  defaultProvince: string;
  onSaved: () => void;
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
      <Button
        type="submit"
        disabled={saveM.isPending || !code.trim() || !name.trim() || !provinceCode}
      >
        <IconCheck className="mr-1.5 h-4 w-4" />
        {saveM.isPending ? "Đang lưu…" : row ? "Cập nhật" : "Thêm"}
      </Button>
    </form>
  );
}
