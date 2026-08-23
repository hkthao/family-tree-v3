import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { track } from "@/lib/analytics";
import { invalidateClanData } from "@/lib/cache";
import { displayGen } from "@/lib/displayGeneration";
import { RecordDates } from "@/components/RecordDates";
import {
  deletePersonsBulk,
  listMatchingPersonIds,
  updatePersonsBranchBulk,
} from "@/lib/queries/persons";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  IconCopy,
  IconGrid,
  IconList,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconTree,
  IconUpload,
  IconUsers,
  IconX,
} from "@/components/icons";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { PersonAvatar } from "@/components/PersonAvatar";
import { MemoryRoomCtaButton } from "@/components/MemoryRoomCta";
import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useAuth } from "@/hooks/useAuth";
import { useUrlPatch } from "@/hooks/useUrlState";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { listBranches } from "@/lib/queries/branches";
import { getClanStats } from "@/lib/queries/clan-stats";
import { queryKeys } from "@/lib/queries/keys";
import { getClanCompletion, type ClanCompletion } from "@/lib/queries/todo";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { listPersons, type PersonRow } from "@/lib/queries/persons";
import {
  getRelativesIndex,
  type RelativesIndex,
} from "@/lib/queries/relatives-index";
import { KinshipContent } from "@/pages/clan/Kinship";
import { KhoeButton } from "@/components/KhoeButton";

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
const VIEW_KEY = "family-tree:people-view-mode";
type ViewMode = "list" | "grid";

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export default function People() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // Filters / paging live in the URL so Back from a person detail
  // restores the search + filters instead of resetting them. See
  // useUrlState.ts. A single action that also resets the page writes
  // both params in one patch() call to avoid clobbering.
  const [sp] = useSearchParams();
  const patch = useUrlPatch();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.max(1, Number(sp.get("ps")) || 15);
  const debounced = sp.get("q") ?? "";
  const branchId = sp.get("branch") ?? "";
  const generation = sp.get("gen") ?? "";
  const sortRaw = sp.get("sort") ?? "generation";
  const sort: "name" | "generation" | "birth" =
    sortRaw === "name" || sortRaw === "birth" ? sortRaw : "generation";
  // Chế độ xem: "people" (danh bạ) | "kinship" (tra cứu xưng hô). Lưu ở
  // URL (?view=kinship) — route cũ /kinship redirect sang đây. Xưng hô
  // cần biết quan hệ nên chỉ mở cho thành viên.
  const isMember = effectiveRole(clan) !== null;
  const view: "people" | "kinship" =
    isMember && sp.get("view") === "kinship" ? "kinship" : "people";

  const setPage = (n: number) => patch({ page: n <= 1 ? null : String(n) });
  const setPageSize = (n: number) =>
    patch({ ps: n === 50 ? null : String(n), page: null });
  const setBranchId = (v: string) => patch({ branch: v || null, page: null });
  const setGeneration = (v: string) => patch({ gen: v || null, page: null });
  const setSort = (v: "name" | "generation" | "birth") =>
    patch({ sort: v === "generation" ? null : v, page: null });

  // The text box keeps its own live value (seeded from the URL); only
  // the debounced value is pushed to the URL + used for the query.
  const [search, setSearch] = useState(debounced);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBranch, setBulkBranch] = useState<string>("");

  // Persist viewMode globally — same preference across clans.
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      // private mode — ignore
    }
  }, [viewMode]);

  // Debounce search input → URL. Skip the initial run (search === URL
  // value) so a Back that restored ?page=2 isn't reset to page 1.
  useEffect(() => {
    const h = setTimeout(() => {
      if (search !== debounced) patch({ q: search || null, page: null });
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Drop the selection when the *result set* changes (different
  // filter / sort). Page changes preserve the selection now that the
  // toolbar shows "Đã chọn N/total" + an explicit "Chọn tất cả X kết
  // quả" action, so cross-page selection is intentional and visible.
  useEffect(() => {
    setSelected(new Set());
  }, [debounced, branchId, generation, sort]);

  // Đo lượt dùng tìm kiếm danh bạ (khi từ khoá đủ dài, sau debounce).
  useEffect(() => {
    if (debounced.trim().length >= 2) track("people_searched");
  }, [debounced]);

  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const bulkChangeBranchM = useMutation({
    mutationFn: () =>
      updatePersonsBranchBulk(
        [...selected],
        bulkBranch === "" ? null : bulkBranch,
      ),
    onSuccess: async (res) => {
      await invalidateClanData(qc, clan.id);
      const branchName =
        bulkBranch === ""
          ? "không có chi"
          : (branches?.find((b) => b.id === bulkBranch)?.name ?? "");
      toast.success(`Đã đổi chi cho ${res.updated} người`, {
        description: `Mới: ${branchName}`,
      });
      setSelected(new Set());
    },
    onError: (e) => toast.error("Không đổi được chi", { description: (e as Error).message }),
  });
  // Pull every id matching the current filter (across pages) so the
  // user can bulk-select past the current visible window. Lazy: only
  // fires when the user clicks "Chọn tất cả N kết quả".
  const selectAllMatchingM = useMutation({
    mutationFn: () =>
      listMatchingPersonIds(clan.id, {
        search: debounced,
        branchId: branchId || null,
        generation: generation ? Number(generation) : null,
        source,
      }),
    onSuccess: (ids) => {
      setSelected(new Set(ids));
      toast.success(`Đã chọn ${ids.length} người khớp bộ lọc`);
    },
    onError: (e) =>
      toast.error("Không chọn được", { description: (e as Error).message }),
  });

  const bulkDeleteM = useMutation({
    mutationFn: () => deletePersonsBulk([...selected]),
    onSuccess: async (res) => {
      await invalidateClanData(qc, clan.id);
      toast.success(`Đã xoá ${res.deleted} người`, {
        description: "Có thể khôi phục từ nhật ký.",
      });
      setSelected(new Set());
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage(rows: PersonRow[] | undefined, on: boolean) {
    if (!rows) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  // Non-members of a public clan read through the masked view; everyone
  // else (admin/editor/viewer + platform admin) reads the raw table.
  const source =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";

  const params = {
    page,
    pageSize,
    search: debounced,
    branchId: branchId || null,
    generation: generation ? Number(generation) : null,
    sort,
    source,
  } as const;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.persons(clan.id, userId, params),
    queryFn: () => listPersons(clan.id, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  // Branches list for filter dropdown
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches(clan.id, userId),
    queryFn: () => listBranches(clan.id),
    enabled: !!userId,
  });

  // Stats — used to know max_generation so we can offer 1..N in the filter
  const { data: stats } = useQuery({
    queryKey: queryKeys.clanStats(clan.id, userId),
    queryFn: () => getClanStats(clan.id),
    enabled: !!userId,
  });
  const maxGen = stats?.max_generation ?? null;

  // Member-only RPC; skip for non-members of public clans to avoid
  // a 403 in the console (they don't see the strip anyway).
  const { data: completion } = useQuery({
    queryKey: queryKeys.clanCompletion(clan.id, userId),
    queryFn: () => getClanCompletion(clan.id),
    enabled: !!userId && effectiveRole(clan) !== null,
    staleTime: 60_000,
  });

  // Clan-wide relatives lookup (father / mother / spouses by id).
  // Only members + platform admin should see relatives; non-members of a
  // public clan get hidden relatives because the query reads `persons`
  // (RLS will already block them). Skip the call entirely for guests.
  const { data: relatives } = useQuery({
    queryKey: queryKeys.relativesIndex(clan.id, userId),
    queryFn: () => getRelativesIndex(clan.id),
    enabled: !!userId && source === "persons",
  });

  // Batch-resolve signed URLs for the photos visible on this page.
  // Keyed by the sorted set of paths so re-renders share the cache.
  const photoPaths = [
    ...new Set(
      (data?.rows ?? [])
        .map((p) => p.photo_path)
        .filter((p): p is string => !!p),
    ),
  ].sort();
  const { data: photoUrls } = useQuery({
    queryKey: ["signed-photos-batch", clan.id, photoPaths],
    queryFn: () => getSignedPhotoUrlMap(photoPaths),
    enabled: photoPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canEdit = canEditClan(clan);

  // Nút thao tác (refresh/phòng ký ức/thêm/nhập/AI) — render NGAY TRÊN danh
  // sách, ngang hàng nút "Bộ lọc" (qua CollapsibleFilters) cho gần tầm tay,
  // thay vì nằm tít trên header phải cuộn lên.
  const actionButtons = (
    <>
      {isMember && <MemoryRoomCtaButton clanId={clan.id} />}
      {canEdit && (
        <>
          <Button asChild size="sm" className="h-10 px-2.5 sm:px-3">
            <Link
              to={`/clans/${clan.id}/people/new`}
              aria-label="Thêm người"
              data-testid="add-person-link"
            >
              <IconPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Thêm người</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-10 px-2.5 sm:px-3">
            <Link
              to={`/clans/${clan.id}/import`}
              aria-label="Nhập Excel"
              title="Nhập từ Excel"
            >
              <IconUpload className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Nhập Excel</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-10 px-2.5 sm:px-3">
            <Link
              to={`/clans/${clan.id}/ai-generate`}
              aria-label="Sinh bằng AI"
              title="Mô tả gia đình → AI sinh dữ liệu"
            >
              <IconSparkles className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sinh bằng AI</span>
            </Link>
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      {/* Header row — title + icon refresh + add + import buttons.
          All wrap onto a second line on viewports too narrow for
          one row. h-10 across so they line up. */}
      <PageHeader
        icon={<IconUsers className="h-7 w-7" />}
        title="Danh bạ"
        description={
          view === "kinship"
            ? "Chọn hai người trong họ để xem cách xưng hô theo truyền thống Việt."
            : "Danh sách thành viên với lọc, tìm kiếm và import hàng loạt."
        }
      />

      {isMember && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SegmentedControl ariaLabel="Chế độ xem" className="w-full sm:w-auto sm:shrink-0">
            <SegmentedButton
              active={view === "people"}
              onClick={() => patch({ view: null })}
              ariaLabel="Xem danh bạ"
              className="flex-1 px-3 whitespace-nowrap"
            >
              Danh bạ
            </SegmentedButton>
            <SegmentedButton
              active={view === "kinship"}
              onClick={() => patch({ view: "kinship" })}
              ariaLabel="Tra cứu xưng hô"
              className="flex-1 px-3 whitespace-nowrap"
            >
              Xưng hô
            </SegmentedButton>
          </SegmentedControl>

          {/* Thanh tiến độ — cùng hàng với toggle trên desktop. */}
          {view === "people" &&
            completion &&
            completion.total > 0 &&
            completion.percent !== null && (
              <div className="flex-1 min-w-0">
                <CompactCompletion clanId={clan.id} completion={completion} />
              </div>
            )}
        </div>
      )}

      {view === "kinship" ? (
        <KinshipContent clanId={clan.id} userId={userId} />
      ) : (
      <>
      {/* Hàng tìm kiếm + toggle Danh sách/Thẻ — LUÔN hiện (không giấu sau
          "Bộ lọc"), vì đổi kiểu xem là thao tác thường dùng. */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchInput
            label="Tìm theo tên"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, biệt danh, nơi sinh, tiểu sử…"
            rightSlot={
              <RefreshButton
                clanId={clan.id}
                cachedVersion={clan.data_version}
                compact
                className="h-8 w-8 border-0 bg-transparent hover:bg-muted"
              />
            }
          />
        </div>
        <SegmentedControl ariaLabel="Chế độ hiển thị">
          <SegmentedButton
            active={viewMode === "list"}
            onClick={() => setViewMode("list")}
            title="Danh sách"
            ariaLabel="Danh sách"
            variant="icon-md"
          >
            <IconList className="h-4 w-4" />
          </SegmentedButton>
          <SegmentedButton
            active={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            title="Thẻ"
            ariaLabel="Thẻ"
            variant="icon-md"
          >
            <IconGrid className="h-4 w-4" />
          </SegmentedButton>
        </SegmentedControl>
      </div>

      {/* Bộ lọc chi/đời/sắp xếp. Mobile: thu sau nút "Bộ lọc" + XẾP DỌC
          full-width cho dễ chạm; desktop: một hàng ngang. */}
      <CollapsibleFilters
        activeCount={
          (branchId ? 1 : 0) + (generation ? 1 : 0) + (sort !== "generation" ? 1 : 0)
        }
        actions={
          view === "people" && (isMember || canEdit) ? actionButtons : undefined
        }
      >
      {/* sm:mt-3 — desktop CollapsibleFilters là `sm:contents` nên space-y của
          parent bị bỏ qua; đặt margin trực tiếp để search không dính hàng lọc. */}
      <div className="flex flex-col gap-2 sm:mt-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          icon={<IconGrid />}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Lọc theo chi"
          className="sm:w-auto sm:flex-1 sm:min-w-[140px]"
        >
          <option value="">Tất cả chi</option>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select
          icon={<IconUsers />}
          value={generation}
          onChange={(e) => setGeneration(e.target.value)}
          aria-label="Lọc theo đời"
          className="disabled:opacity-50 sm:w-auto sm:flex-1 sm:min-w-[120px]"
          disabled={!maxGen}
        >
          <option value="">Tất cả đời</option>
          {maxGen
            ? Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Đời {g - clan.generation_offset}
                </option>
              ))
            : null}
        </Select>
        <Select
          icon={<IconList />}
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sắp xếp"
          className="sm:w-auto sm:flex-1 sm:min-w-[120px]"
        >
          <option value="generation">Sắp: Đời</option>
          <option value="name">Sắp: Tên</option>
          <option value="birth">Sắp: Năm sinh</option>
        </Select>
      </div>
      </CollapsibleFilters>

      {/* Results — guard against the (rare but real) state where the
          query is briefly disabled (e.g. while a sibling useAuth() is
          still settling), so `data` is undefined and `isLoading` is
          false at the same time. */}
      {/* Bulk-action toolbar — shows when ≥ 1 person is selected. */}
      {canEdit && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium mr-1">
            Đã chọn {selected.size}
            {total > 0 ? ` / ${total}` : ""} người
          </span>
          <Select
          icon={<IconGrid />}
            value={bulkBranch}
            onChange={(e) => setBulkBranch(e.target.value)}
            aria-label="Đổi chi cho lựa chọn"
            className="sm:w-auto"
          >
            <option value="">(không có chi)</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={() => bulkChangeBranchM.mutate()}
            disabled={bulkChangeBranchM.isPending}
          >
            <IconTree className="h-4 w-4 mr-1.5" />
            {bulkChangeBranchM.isPending ? "Đang đổi…" : "Đổi chi"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={bulkDeleteM.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Xoá ${selected.size} người?`,
                description:
                  "Mỗi người được xoá mềm và có thể khôi phục từ nhật ký.",
                confirmLabel: "Xoá",
                destructive: true,
              });
              if (ok) bulkDeleteM.mutate();
            }}
          >
            <IconTrash className="h-4 w-4 mr-1.5" />
            {bulkDeleteM.isPending ? "Đang xoá…" : "Xoá"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(new Set())}
          >
            <IconX className="h-4 w-4 mr-1.5" />
            Bỏ chọn
          </Button>
        </div>
      )}
      {(bulkChangeBranchM.error || bulkDeleteM.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {((bulkChangeBranchM.error ?? bulkDeleteM.error) as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {!data ? (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      ) : data.rows.length === 0 ? (
        debounced || branchId || generation ? (
          <EmptyState
            icon={<IconSearch className="h-10 w-10" />}
            title="Không tìm thấy ai khớp bộ lọc"
            description="Thử bỏ bớt từ khoá, đổi chi hoặc đời để mở rộng kết quả."
            primary={{
              label: "Xoá bộ lọc",
              onClick: () => {
                setSearch("");
                patch({ q: null, branch: null, gen: null, page: null });
              },
            }}
          />
        ) : (
          <EmptyState
            icon={<IconUsers className="h-10 w-10" />}
            title="Chưa có ai trong dòng họ"
            description="Thêm thuỷ tổ trước, các thế hệ con cháu nối vào dễ hơn. Nếu đã có dữ liệu sẵn ở file Excel, dùng nhập hàng loạt."
            primary={
              canEdit
                ? {
                    label: "Thêm người",
                    to: `/clans/${clan.id}/people/new`,
                    icon: <IconPlus className="h-4 w-4 mr-1.5" />,
                  }
                : null
            }
            secondary={
              canEdit
                ? {
                    label: "Nhập từ Excel",
                    to: `/clans/${clan.id}/import`,
                    icon: <IconUpload className="h-4 w-4 mr-1.5" />,
                  }
                : null
            }
            tertiary={
              canEdit
                ? {
                    label: "Sinh bằng AI",
                    to: `/clans/${clan.id}/ai-generate`,
                    icon: <IconSparkles className="h-4 w-4 mr-1.5" />,
                  }
                : null
            }
          />
        )
      ) : viewMode === "list" ? (
        <ul className="divide-y rounded-lg border bg-card overflow-hidden">
          {canEdit && (
            <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-muted/30">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    data.rows.length > 0 &&
                    data.rows.every((r) => selected.has(r.id))
                  }
                  onChange={(e) =>
                    toggleAllOnPage(data.rows, e.target.checked)
                  }
                  className="h-4 w-4 accent-primary"
                />
                Chọn cả trang này ({data.rows.length})
              </label>
              {total > data.rows.length && selected.size < total && (
                <button
                  type="button"
                  onClick={() => selectAllMatchingM.mutate()}
                  disabled={selectAllMatchingM.isPending}
                  className="text-sm text-primary hover:underline underline-offset-2"
                >
                  {selectAllMatchingM.isPending
                    ? "Đang chọn…"
                    : `Chọn tất cả ${total} kết quả khớp bộ lọc`}
                </button>
              )}
            </li>
          )}
          {data.rows.map((p) => (
            <PersonListItem
              key={p.id}
              person={p}
              clanId={clan.id}
              clanName={clan.name}
              genOffset={clan.generation_offset}
              canCreateQr={effectiveRole(clan) !== null}
              showKhoe={isMember}
              relatives={relatives}
              photoUrl={p.photo_path ? (photoUrls?.get(p.photo_path) ?? null) : null}
              selectable={canEdit}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleSelected(p.id)}
              canCopy={canEdit}
            />
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.rows.map((p) => (
            <PersonGridCard
              key={p.id}
              person={p}
              clanId={clan.id}
              genOffset={clan.generation_offset}
              relatives={relatives}
              photoUrl={p.photo_path ? (photoUrls?.get(p.photo_path) ?? null) : null}
              selectable={canEdit}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleSelected(p.id)}
              canCopy={canEdit}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        unit="người"
        isFetching={isFetching}
        onPageChange={setPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />
      </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function lifespan(person: PersonRow): string {
  const by = person.birth_date?.slice(0, 4);
  const dy = person.death_date?.slice(0, 4);
  if (!person.is_living) {
    if (by && dy) return `${by}–${dy}`;
    if (dy) return `?–${dy}`;
    if (by) return `${by}–?`;
    return "đã mất";
  }
  return by ? `sinh ${by}` : "";
}

function genderLabel(g: "M" | "F"): string {
  return g === "M" ? "♂ Nam" : "♀ Nữ";
}

function spouseLabel(g: "M" | "F"): string {
  return g === "M" ? "Vợ" : "Chồng";
}

interface RelativeNames {
  father: string | null;
  mother: string | null;
  spouses: string[];
}

function lookupRelatives(
  personId: string,
  index: RelativesIndex | undefined,
): RelativeNames {
  if (!index) return { father: null, mother: null, spouses: [] };
  const fId = index.fatherOf.get(personId);
  const mId = index.motherOf.get(personId);
  const sIds = index.spousesOf.get(personId) ?? [];
  return {
    father: fId ? (index.byId.get(fId)?.full_name ?? null) : null,
    mother: mId ? (index.byId.get(mId)?.full_name ?? null) : null,
    spouses: sIds
      .map((id) => index.byId.get(id)?.full_name)
      .filter((n): n is string => !!n),
  };
}

/** Dòng "Tạo … • Cập nhật …" cho một người — ẩn khi không có ngày
 *  (vd: khách xem qua view công khai không nhận được metadata này). */
function PersonDates({
  person,
  className,
}: {
  person: PersonRow;
  className: string;
}) {
  return (
    <RecordDates
      createdAt={person.created_at}
      updatedAt={person.updated_at}
      className={className}
    />
  );
}

function PersonListItem({
  person,
  clanId,
  clanName,
  genOffset,
  canCreateQr,
  showKhoe,
  relatives,
  photoUrl,
  selectable,
  selected,
  onToggleSelect,
  canCopy,
}: {
  person: PersonRow;
  clanId: string;
  clanName: string;
  genOffset: number;
  canCreateQr: boolean;
  showKhoe?: boolean;
  relatives: RelativesIndex | undefined;
  photoUrl: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  canCopy?: boolean;
}) {
  const rel = lookupRelatives(person.id, relatives);
  const life = lifespan(person);
  const metaBits = [genderLabel(person.gender)];
  if (life) metaBits.push(life);
  const dispGen = displayGen(person.generation, genOffset);
  if (dispGen !== null) metaBits.push(`Đời ${dispGen}`);

  return (
    <li className="relative flex items-start gap-2">
      {selectable && (
        <label className="pl-3 pt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            className="h-4 w-4 accent-primary"
            aria-label={`Chọn ${person.full_name}`}
          />
        </label>
      )}
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className="flex flex-1 min-w-0 items-start gap-3 p-3 hover:bg-muted/40 transition-colors"
      >
        <PersonAvatar
          gender={person.gender}
          photoUrl={photoUrl}
          size={44}
          className={person.is_living ? "" : "opacity-80"}
        />
        <div className="min-w-0 flex-1">
          {/* Name line: pr-9 chừa chỗ cho copy button (absolute top-right).
              Các dòng meta + cha/mẹ/vợ phía dưới full width → hiển thị
              được nhiều hơn vì copy button ko còn chiếm 1 cột bên phải. */}
          <p className={`font-medium truncate ${canCopy ? "pr-9" : ""}`}>
            {person.full_name}
            {person.is_root && (
              <span className="ml-2 text-xs text-accent font-medium">
                Thuỷ tổ
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {metaBits.join(" · ")}
          </p>
          {(rel.father || rel.mother || rel.spouses.length > 0) && (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {(rel.father || rel.mother) && (
                <p className="truncate">
                  {rel.father && (
                    <>
                      <span className="font-medium">Cha:</span> {rel.father}
                    </>
                  )}
                  {rel.father && rel.mother && (
                    <span className="mx-1.5 text-muted-foreground/60">·</span>
                  )}
                  {rel.mother && (
                    <>
                      <span className="font-medium">Mẹ:</span> {rel.mother}
                    </>
                  )}
                </p>
              )}
              {rel.spouses.length > 0 && (
                <p className="truncate">
                  <span className="font-medium">
                    {spouseLabel(person.gender)}:
                  </span>{" "}
                  {rel.spouses.join(", ")}
                </p>
              )}
            </div>
          )}
          <PersonDates
            person={person}
            className="text-xs text-muted-foreground/80 mt-1 truncate"
          />
        </div>
      </Link>
      {canCopy && (
        <Link
          to={`/clans/${clanId}/people/new?from=${person.id}`}
          aria-label={`Sao chép ${person.full_name}`}
          title="Sao chép thành người mới"
          className="absolute top-2 right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted"
        >
          <IconCopy className="h-4 w-4" />
        </Link>
      )}
      {showKhoe && (
        <KhoeButton
          iconOnly
          variant="ghost"
          clanId={clanId}
          clanName={clanName}
          genOffset={genOffset}
          canCreateQr={canCreateQr}
          person={{
            id: person.id,
            full_name: person.full_name,
            generation: person.generation,
            photo_path: person.photo_path,
          }}
          className={`absolute right-2 z-10 h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-muted ${
            canCopy ? "top-11" : "top-2"
          }`}
        />
      )}
    </li>
  );
}

function PersonGridCard({
  person,
  clanId,
  genOffset,
  relatives,
  photoUrl,
  selectable,
  selected,
  onToggleSelect,
  canCopy,
}: {
  person: PersonRow;
  clanId: string;
  genOffset: number;
  relatives: RelativesIndex | undefined;
  photoUrl: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  canCopy?: boolean;
}) {
  const rel = lookupRelatives(person.id, relatives);
  const life = lifespan(person);
  const dispGen = displayGen(person.generation, genOffset);

  return (
    <li className="relative">
      {selectable && (
        <label className="absolute top-2 left-2 z-10 cursor-pointer rounded bg-card/80 p-0.5 backdrop-blur">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            className="h-4 w-4 accent-primary block"
            aria-label={`Chọn ${person.full_name}`}
          />
        </label>
      )}
      {canCopy && (
        <Link
          to={`/clans/${clanId}/people/new?from=${person.id}`}
          aria-label={`Sao chép ${person.full_name}`}
          title="Sao chép thành người mới"
          className="absolute top-2 right-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/80 text-muted-foreground hover:text-primary backdrop-blur"
        >
          <IconCopy className="h-4 w-4" />
        </Link>
      )}
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className={`flex flex-col items-center text-center gap-2 rounded-lg border bg-card p-3 hover:border-primary transition-colors h-full ${
          selected ? "border-primary ring-1 ring-primary/30" : ""
        }`}
      >
        <PersonAvatar
          gender={person.gender}
          photoUrl={photoUrl}
          size={64}
          className={person.is_living ? "" : "opacity-80"}
        />
        <div className="min-w-0 w-full">
          <p className="font-medium text-sm leading-tight truncate">
            {person.full_name}
          </p>
          {person.is_root && (
            <p className="text-xs text-accent font-medium mt-0.5">Thuỷ tổ</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {genderLabel(person.gender)}
            {life ? ` · ${life}` : ""}
          </p>
          {dispGen !== null && (
            <p className="text-xs text-muted-foreground truncate">
              Đời {dispGen}
            </p>
          )}
          {rel.spouses.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              <span className="font-medium">
                {spouseLabel(person.gender)}:
              </span>{" "}
              {rel.spouses[0]}
              {rel.spouses.length > 1 ? ` +${rel.spouses.length - 1}` : ""}
            </p>
          )}
          <PersonDates
            person={person}
            className="text-[10px] text-muted-foreground/80 mt-1 truncate"
          />
        </div>
      </Link>
    </li>
  );
}

// Single-line inline strip — fills the width above the search row.
// Intentionally NO card chrome: too much visual weight here competes
// with the action buttons and the filter row. Whole strip is the
// link so the target area is generous.
function CompactCompletion({
  clanId,
  completion,
}: {
  clanId: string;
  completion: ClanCompletion;
}) {
  const { percent, withGaps } = completion;
  if (percent === null) return null;
  const tone =
    percent >= 90
      ? "bg-emerald-500"
      : percent >= 50
        ? "bg-primary"
        : "bg-amber-500";
  return (
    <Link
      to={`/clans/${clanId}/todo`}
      aria-label={`Đã hoàn thành ${percent}%, mở Việc cần làm`}
      className="flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-sm"
    >
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${tone} transition-[width] duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="tabular-nums font-medium">{percent}%</span>
      {withGaps > 0 ? (
        <>
          <span className="text-muted-foreground text-xs">
            <span className="tabular-nums">{withGaps}</span> việc còn
          </span>
          <span className="text-primary" aria-hidden="true">
            →
          </span>
        </>
      ) : (
        <span className="text-xs text-emerald-600">đầy đủ ✓</span>
      )}
    </Link>
  );
}
