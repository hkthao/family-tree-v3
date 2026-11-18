import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { FilterableSelect } from "@/components/FilterableSelect";
import { SearchInput } from "@/components/SearchInput";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import {
  IconDownload,
  IconQrCode,
  IconTree,
  IconLayers,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
} from "@/hooks/useClientPaging";
import { useClanContext } from "@/hooks/useClanContext";
import { listBranches } from "@/lib/queries/branches";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import {
  listPersonsForQrExport,
  type QrExportRow,
} from "@/lib/queries/persons";

import { t } from "@lingui/core/macro";
const MAX_PER_EXPORT = 200;
// Shared input/select classes so all filter controls have the same
// height + border treatment. Copied from the People page pattern so
// users moving between admin tools see a consistent toolbar.

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
  const [nameQ, setNameQ] = useState("");

  // genMin/genMax là display values (user gõ theo cách clan hiển thị).
  // Convert sang raw generation = display + offset trước khi query.
  const filters = useMemo(
    () => ({
      branchId: branchId || null,
      generationMin: genMin ? Number(genMin) + clan.generation_offset : null,
      generationMax: genMax ? Number(genMax) + clan.generation_offset : null,
      deceasedOnly,
      limit: MAX_PER_EXPORT,
    }),
    [branchId, genMin, genMax, deceasedOnly, clan.generation_offset],
  );

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches(clan.id, userId),
    queryFn: () => listBranches(clan.id),
  });

  const {
    data: rows,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["qr-export-people", clan.id, userId, filters],
    queryFn: () => listPersonsForQrExport(clan.id, filters),
  });

  // Danh sách đang hiện: lọc thêm theo tên ở máy (danh sách đã giới hạn MAX_PER_EXPORT người).
  const shown = useMemo(() => {
    const q = unaccent(nameQ.trim());
    return q
      ? (rows ?? []).filter((r) => unaccent(r.full_name).includes(q))
      : rows;
  }, [rows, nameQ]);

  // Phân trang ở máy (như Danh bạ): ô đầu danh sách chọn cả TRANG, link "Chọn cả N" chọn mọi kết quả.
  const paging = useClientPaging(shown ?? [], 20);
  const allSelectedOnPage = useMemo(() => {
    if (paging.paged.length === 0) return false;
    return paging.paged.every((r) => selected.has(r.id));
  }, [paging.paged, selected]);

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
      const { downloadBulkPersonQrPdf } =
        await import("@/lib/pdf/exportPersonQrPdf");
      return downloadBulkPersonQrPdf(clan.name, inputs);
    },
    onSuccess: (r) => {
      if (r && "count" in r) toast.success(t`Đã xuất ${r.count} thẻ QR`);
    },
    onError: (e) =>
      toast.error(t`Không xuất được PDF`, {
        description: (e as Error).message,
      }),
  });

  function toggleAll() {
    const next = new Set(selected);
    for (const r of paging.paged) {
      if (allSelectedOnPage) next.delete(r.id);
      else next.add(r.id);
    }
    setSelected(next);
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
          { label: t`Xuất QR cá nhân` },
        ]}
      />

      <PageHeader
        icon={<IconQrCode className="h-7 w-7" />}
        title={t`Xuất QR cá nhân hàng loạt`}
        description={t`Mỗi người 1 thẻ A6 — 4 thẻ / trang A4. In ra cắt theo đường viền.`}
      />

      {/* Tìm theo tên + icon Tuỳ chọn trong ô; chi, khoảng đời, "chỉ người đã mất" nằm trong ngăn kéo (kiểu chung). */}
      <CollapsibleFilters
        activeCount={
          (branchId ? 1 : 0) +
          (genMin || genMax ? 1 : 0) +
          (deceasedOnly ? 0 : 1)
        }
        onReset={() => {
          setBranchId("");
          setGenMin("");
          setGenMax("");
          setDeceasedOnly(true);
        }}
        title={t`Lọc người cần xuất QR`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm người`}
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
            placeholder={t`Tìm theo tên…`}
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <FilterableSelect
            value={branchId}
            onChange={setBranchId}
            aria-label={t`Lọc theo chi`}
            icon={<IconTree />}
            options={(branches ?? []).map((b) => ({
              value: b.id,
              label: b.name,
            }))}
            emptyLabel={t`Tất cả chi`}
            filterLabel={t`Lọc theo chi`}
            className="h-11 text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              inputMode="numeric"
              icon={<IconLayers />}
              min={1}
              value={genMin}
              onChange={(e) => setGenMin(e.target.value)}
              placeholder={t`Đời từ`}
              aria-label={t`Đời từ`}
              className="h-11 text-base"
            />
            <Input
              type="number"
              inputMode="numeric"
              icon={<IconLayers />}
              min={1}
              value={genMax}
              onChange={(e) => setGenMax(e.target.value)}
              placeholder={t`Đời đến`}
              aria-label={t`Đời đến`}
              className="h-11 text-base"
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-base">
            <input
              type="checkbox"
              checked={deceasedOnly}
              onChange={(e) => setDeceasedOnly(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-primary"
            />
            {t`Chỉ người đã mất`}
          </label>
          {/* Xuất PDF: thao tác của trang, nằm trong Tuỳ chọn cho đầu trang gọn (chọn người ở danh sách trước). */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-base font-medium">{t`Xuất thẻ QR`}</p>
            <Button
              className="w-full justify-start"
              onClick={() => exportM.mutate()}
              disabled={selected.size === 0 || exportM.isPending}
            >
              <IconDownload className="mr-1.5 h-4 w-4" />
              {exportM.isPending
                ? t`Đang tạo PDF…`
                : t`Xuất PDF (${selected.size} người đã chọn)`}
            </Button>
            {selected.size === 0 && (
              <p className="text-sm text-muted-foreground">
                {t`Đánh dấu người cần in ở danh sách rồi bấm Xuất PDF.`}
              </p>
            )}
          </div>
        </div>
      </CollapsibleFilters>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {(rows?.length ?? 0) >= MAX_PER_EXPORT && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {t`Giới hạn ${MAX_PER_EXPORT} người mỗi lần — thu hẹp bằng bộ lọc trong Tuỳ chọn.`}
        </p>
      )}

      {shown && shown.length === 0 && !isFetching && (
        <EmptyState
          title={t`Không có ai khớp bộ lọc`}
          description={t`Đổi từ khoá hoặc bộ lọc trong Tuỳ chọn.`}
        />
      )}

      {isFetching && !shown && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {shown && shown.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Hàng chọn gọn như Danh bạ: ô "Chọn tất cả (N)" + nút Xuất PDF ở cùng dòng đầu danh sách. */}
          <li className="flex items-center gap-3 bg-muted/30 px-3 py-1.5">
            <label className="inline-flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={toggleAll}
                className="h-4 w-4 accent-primary"
              />
              <span className="truncate">
                {selected.size > 0
                  ? t`Đã chọn ${selected.size}/${shown.length}`
                  : t`Chọn cả trang (${paging.paged.length})`}
              </span>
            </label>
            {shown.length > paging.paged.length &&
              selected.size < shown.length && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      new Set([...selected, ...shown.map((r) => r.id)]),
                    )
                  }
                  className="shrink-0 text-sm text-primary underline-offset-2 hover:underline"
                >
                  {t`Chọn cả ${shown.length}`}
                </button>
              )}
          </li>
          {paging.paged.map((p) => (
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

      {shown && shown.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit={t`người`}
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
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
            {p.gender === "M" ? t`Nam` : t`Nữ`}
            {p.generation !== null && t` · Đời ${p.generation - genOffset}`}
            {!p.is_living
              ? t` · đã mất${deathYear ? ` ${deathYear}` : ""}`
              : birthYear
                ? t` · sinh ${birthYear}`
                : ""}
          </p>
        </div>
      </label>
    </li>
  );
}
