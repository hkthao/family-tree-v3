import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { IconCheck, IconDownload, IconQrCode, IconTree, IconUsers } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { listBranches } from "@/lib/queries/branches";
import { queryKeys } from "@/lib/queries/keys";
import {
  listPersonsForQrExport,
  type QrExportRow,
} from "@/lib/queries/persons";

const MAX_PER_EXPORT = 200;
// Shared input/select classes so all filter controls have the same
// height + border treatment. Copied from the People page pattern so
// users moving between admin tools see a consistent toolbar.
const CTRL = "h-10 rounded-md border border-input bg-background px-3 text-sm";

/**
 * Admin-only bulk QR export. Filter the clan by branch / generation /
 * deceased-only, multi-select rows, then "Xuất PDF" produces an A4
 * sheet with 4 A6 cards per page. Each card mints (or reuses) a
 * single_person share link so the same physical print keeps resolving.
 */
export default function QrExport() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const toast = useToast();

  const isAdmin = clan.isPlatformAdmin || clan.myRole === "admin";
  if (!isAdmin) return <Navigate to={`/clans/${clan.id}`} replace />;

  const [branchId, setBranchId] = useState<string>("");
  const [genMin, setGenMin] = useState<string>("");
  const [genMax, setGenMax] = useState<string>("");
  const [deceasedOnly, setDeceasedOnly] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // genMin/genMax là display values (user gõ theo cách clan hiển thị).
  // Convert sang raw generation = display + offset trước khi query.
  const filters = useMemo(
    () => ({
      branchId: branchId || null,
      generationMin: genMin
        ? Number(genMin) + clan.generation_offset
        : null,
      generationMax: genMax
        ? Number(genMax) + clan.generation_offset
        : null,
      deceasedOnly,
      limit: MAX_PER_EXPORT,
    }),
    [branchId, genMin, genMax, deceasedOnly, clan.generation_offset],
  );

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches(clan.id, userId),
    queryFn: () => listBranches(clan.id),
  });

  const { data: rows, isFetching, error } = useQuery({
    queryKey: ["qr-export-people", clan.id, userId, filters],
    queryFn: () => listPersonsForQrExport(clan.id, filters),
  });

  const allSelectedOnPage = useMemo(() => {
    if (!rows || rows.length === 0) return false;
    return rows.every((r) => selected.has(r.id));
  }, [rows, selected]);

  const exportM = useMutation({
    mutationFn: async () => {
      if (!rows) return { count: 0 };
      const inputs = rows
        .filter((r) => selected.has(r.id))
        .map((r) => ({
          clanId: clan.id,
          personId: r.id,
          fullName: r.full_name,
          courtesyName: r.courtesy_name,
          // generation = display value (đã trừ offset của clan),
          // QR PDF chỉ in lại con số này.
          generation:
            r.generation !== null
              ? r.generation - clan.generation_offset
              : null,
          birthYear: r.birth_date?.slice(0, 4) ?? null,
          deathYear: r.death_date?.slice(0, 4) ?? null,
          isLiving: r.is_living,
        }));
      // Lazy-load @react-pdf/renderer (~1.5MB) on click so it stays
      // out of the initial app bundle and the PWA precache.
      const { downloadBulkPersonQrPdf } = await import(
        "@/lib/pdf/exportPersonQrPdf"
      );
      return downloadBulkPersonQrPdf(clan.name, inputs);
    },
    onSuccess: (r) => {
      if (r && "count" in r) toast.success(`Đã xuất ${r.count} thẻ QR`);
    },
    onError: (e) =>
      toast.error("Không xuất được PDF", { description: (e as Error).message }),
  });

  function toggleAll() {
    if (!rows) return;
    if (allSelectedOnPage) {
      const next = new Set(selected);
      for (const r of rows) next.delete(r.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const r of rows) next.add(r.id);
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Xuất QR cá nhân" },
        ]}
      />

      <PageHeader
        icon={<IconQrCode className="h-7 w-7" />}
        title="Xuất QR cá nhân hàng loạt"
        description="Mỗi người 1 thẻ A6 — 4 thẻ / trang A4. In ra cắt theo đường viền."
      />

      {/* Filter row — single flex-wrap line, matching the People page
          toolbar so admin tools feel like one family. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Lọc theo chi"
          icon={<IconTree />}
          className={`${CTRL} flex-1 min-w-[160px]`}
        >
          <option value="">Tất cả chi</option>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          icon={<IconUsers />}
          min={1}
          value={genMin}
          onChange={(e) => setGenMin(e.target.value)}
          placeholder="Đời từ"
          aria-label="Đời từ"
          className="h-10 w-[110px]"
        />
        <Input
          type="number"
          icon={<IconUsers />}
          min={1}
          value={genMax}
          onChange={(e) => setGenMax(e.target.value)}
          placeholder="Đời đến"
          aria-label="Đời đến"
          className="h-10 w-[110px]"
        />
        <button
          type="button"
          onClick={() => setDeceasedOnly((v) => !v)}
          aria-pressed={deceasedOnly}
          className={`inline-flex items-center gap-1.5 px-3 h-10 text-sm rounded-md border ${
            deceasedOnly
              ? "bg-primary text-primary-foreground border-primary"
              : "border-input bg-background hover:bg-muted/50"
          }`}
        >
          {deceasedOnly && <IconCheck className="h-4 w-4" />}
          Chỉ người đã mất
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Action bar — counter on the left, bulk actions on the right.
          Pinned to one row on desktop, wraps cleanly on mobile. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2">
        <p className="text-sm">
          <span className="font-medium">
            {isFetching ? "Đang tải…" : `${rows?.length ?? 0} người`}
          </span>
          {!isFetching && (
            <span className="text-muted-foreground">
              {" · "}
              {selected.size} đã chọn
            </span>
          )}
          {(rows?.length ?? 0) >= MAX_PER_EXPORT && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              · Giới hạn {MAX_PER_EXPORT} người mỗi lần
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            disabled={!rows?.length}
          >
            <IconCheck className="h-4 w-4 mr-1.5" />
            {allSelectedOnPage ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </Button>
          <Button
            size="sm"
            onClick={() => exportM.mutate()}
            disabled={selected.size === 0 || exportM.isPending}
          >
            <IconDownload className="h-4 w-4 mr-1.5" />
            {exportM.isPending ? "Đang tạo PDF…" : `Xuất PDF (${selected.size})`}
          </Button>
        </div>
      </div>

      {rows && rows.length === 0 && !isFetching && (
        <EmptyState
          title="Không có ai khớp bộ lọc"
          description="Đổi điều kiện ở trên."
        />
      )}

      {rows && rows.length > 0 && (
        <ul className="rounded-md border divide-y bg-card overflow-hidden">
          {rows.map((p) => (
            <PersonRow
              key={p.id}
              p={p}
              genOffset={clan.generation_offset}
              checked={selected.has(p.id)}
              onToggle={() => toggleOne(p.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonRow({
  p,
  genOffset,
  checked,
  onToggle,
}: {
  p: QrExportRow;
  genOffset: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const birthYear = p.birth_date?.slice(0, 4);
  const deathYear = p.death_date?.slice(0, 4);
  return (
    <li>
      <label
        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
          checked ? "bg-primary/5" : "hover:bg-muted/30"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{p.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {p.gender === "M" ? "Nam" : "Nữ"}
            {p.generation !== null &&
              ` · Đời ${p.generation - genOffset}`}
            {!p.is_living
              ? ` · đã mất${deathYear ? ` ${deathYear}` : ""}`
              : birthYear
                ? ` · sinh ${birthYear}`
                : ""}
          </p>
        </div>
      </label>
    </li>
  );
}
