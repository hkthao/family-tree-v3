import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { invalidateClanData } from "@/lib/cache";
import {
  deletePersonsBulk,
  listMatchingPersonIds,
  updatePersonsBranchBulk,
} from "@/lib/queries/persons";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  IconArrowLeft,
  IconArrowRight,
  IconCopy,
  IconGrid,
  IconList,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconUpload,
  IconUsers,
} from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { PersonAvatar } from "@/components/PersonAvatar";
import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { listBranches } from "@/lib/queries/branches";
import { getClanStats } from "@/lib/queries/clan-stats";
import { queryKeys } from "@/lib/queries/keys";
import { getClanCompletion, type ClanCompletion } from "@/lib/queries/todo";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { listPersons, type PersonRow } from "@/lib/queries/persons";
import {
  getRelativesIndex,
  type RelativesIndex,
} from "@/lib/queries/relatives-index";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [generation, setGeneration] = useState<string>("");
  const [sort, setSort] = useState<"name" | "generation" | "birth">("name");
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

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  // Reset to page 1 when any filter besides search changes
  useEffect(() => {
    setPage(1);
  }, [branchId, generation, sort, pageSize]);

  // Drop the selection when the *result set* changes (different
  // filter / sort). Page changes preserve the selection now that the
  // toolbar shows "Đã chọn N/total" + an explicit "Chọn tất cả X kết
  // quả" action, so cross-page selection is intentional and visible.
  useEffect(() => {
    setSelected(new Set());
  }, [debounced, branchId, generation, sort]);

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
    staleTime: 5 * 60 * 1000,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canEdit = canEditClan(clan);

  return (
    <div className="space-y-3">
      {/* Header row — title + icon refresh + add + import buttons.
          All wrap onto a second line on viewports too narrow for
          one row. h-10 across so they line up. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <h2 className="text-2xl font-semibold sm:flex-1">Danh bạ</h2>
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
        <RefreshButton
          clanId={clan.id}
          cachedVersion={clan.data_version}
          compact
        />
        {canEdit && (
          <>
            <Button
              asChild
              size="sm"
              className="h-10 px-2.5 sm:px-3"
            >
              <Link
                to={`/clans/${clan.id}/people/new`}
                aria-label="Thêm người"
              >
                <IconPlus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Thêm người</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-10 px-2.5 sm:px-3"
            >
              <Link
                to={`/clans/${clan.id}/import`}
                aria-label="Nhập Excel"
                title="Nhập từ Excel"
              >
                <IconUpload className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Nhập Excel</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-10 px-2.5 sm:px-3"
            >
              <Link
                to={`/clans/${clan.id}/ai-generate`}
                aria-label="Sinh bằng AI"
                title="Mô tả gia đình → AI sinh dữ liệu → dán vào và tạo hàng loạt"
              >
                <IconSparkles className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sinh bằng AI</span>
              </Link>
            </Button>
          </>
        )}
        </div>
      </div>

      {completion && completion.total > 0 && completion.percent !== null && (
        <CompactCompletion clanId={clan.id} completion={completion} />
      )}

      {/* Search row — full width, owns one line. */}
      <SearchInput
        label="Tìm theo tên"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo tên, biệt danh, nơi sinh, tiểu sử…"
      />

      {/* Toolbar — filters + sort + view toggle in one wrap row. */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Lọc theo chi"
          className="h-10 flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả chi</option>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={generation}
          onChange={(e) => setGeneration(e.target.value)}
          aria-label="Lọc theo đời"
          className="h-10 flex-1 min-w-[120px] rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          disabled={!maxGen}
        >
          <option value="">Tất cả đời</option>
          {maxGen
            ? Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Đời {g}
                </option>
              ))
            : null}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sắp xếp"
          className="h-10 flex-1 min-w-[120px] rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="name">Sắp: Tên</option>
          <option value="generation">Sắp: Đời</option>
          <option value="birth">Sắp: Năm sinh</option>
        </select>
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
          <select
            value={bulkBranch}
            onChange={(e) => setBulkBranch(e.target.value)}
            aria-label="Đổi chi cho lựa chọn"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">(không có chi)</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => bulkChangeBranchM.mutate()}
            disabled={bulkChangeBranchM.isPending}
          >
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
            {bulkDeleteM.isPending ? "Đang xoá…" : "Xoá"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(new Set())}
          >
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
                setBranchId("");
                setGeneration("");
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

      {/* Pagination */}
      <div className="flex items-center justify-between flex-wrap gap-3 text-sm">
        <div className="text-muted-foreground">
          {total > 0
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total} người`
            : "—"}
          {isFetching && <span className="ml-2 italic">đang tải…</span>}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-muted-foreground">
            <span className="sr-only">Số dòng mỗi trang</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ml-1 h-10 rounded-md border border-input bg-background px-2"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}/trang
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <IconArrowLeft className="h-4 w-4 mr-1" />
            Trước
          </Button>
          <span className="px-2">
            {page}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Sau
            <IconArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
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

function PersonListItem({
  person,
  clanId,
  relatives,
  photoUrl,
  selectable,
  selected,
  onToggleSelect,
  canCopy,
}: {
  person: PersonRow;
  clanId: string;
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
  if (person.generation !== null) metaBits.push(`Đời ${person.generation}`);

  return (
    <li className="flex items-start gap-2">
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
          <p className="font-medium truncate">
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
        </div>
      </Link>
      {canCopy && (
        <Link
          to={`/clans/${clanId}/people/new?from=${person.id}`}
          aria-label={`Sao chép ${person.full_name}`}
          title="Sao chép thành người mới"
          className="self-center mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted"
        >
          <IconCopy className="h-4 w-4" />
        </Link>
      )}
    </li>
  );
}

function PersonGridCard({
  person,
  clanId,
  relatives,
  photoUrl,
  selectable,
  selected,
  onToggleSelect,
  canCopy,
}: {
  person: PersonRow;
  clanId: string;
  relatives: RelativesIndex | undefined;
  photoUrl: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  canCopy?: boolean;
}) {
  const rel = lookupRelatives(person.id, relatives);
  const life = lifespan(person);

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
          className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-card/80 text-muted-foreground hover:text-primary backdrop-blur"
        >
          <IconCopy className="h-3.5 w-3.5" />
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
            <p className="text-[10px] text-accent font-medium mt-0.5">Thuỷ tổ</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {genderLabel(person.gender)}
            {life ? ` · ${life}` : ""}
          </p>
          {person.generation !== null && (
            <p className="text-xs text-muted-foreground truncate">
              Đời {person.generation}
            </p>
          )}
          {rel.spouses.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              <span className="font-medium">
                {spouseLabel(person.gender)}:
              </span>{" "}
              {rel.spouses[0]}
              {rel.spouses.length > 1 ? ` +${rel.spouses.length - 1}` : ""}
            </p>
          )}
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
