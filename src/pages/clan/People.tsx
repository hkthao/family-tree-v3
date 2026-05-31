import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  IconArrowLeft,
  IconArrowRight,
  IconGrid,
  IconList,
  IconPlus,
} from "@/components/icons";
import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { listBranches } from "@/lib/queries/branches";
import { getClanStats } from "@/lib/queries/clan-stats";
import { queryKeys } from "@/lib/queries/keys";
import { listPersons, type PersonRow } from "@/lib/queries/persons";

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

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canEdit = canEditClan(clan);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Danh bạ</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
          {canEdit && (
            <Button asChild>
              <Link to={`/clans/${clan.id}/people/new`}>
                <IconPlus className="h-4 w-4 mr-1.5" />
                Thêm người
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters row — single line on lg+; everything h-10 for density. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            label="Tìm theo tên"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên — gõ không dấu cũng được"
          />
        </div>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Lọc theo chi"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[120px] disabled:opacity-50"
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
      </div>

      {/* Toolbar: sort + view mode toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <label className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">Sắp xếp:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 rounded-md border border-input bg-background px-2"
          >
            <option value="name">Tên</option>
            <option value="generation">Đời</option>
            <option value="birth">Năm sinh</option>
          </select>
        </label>
        <div
          className="inline-flex rounded-md border bg-card overflow-hidden"
          role="group"
          aria-label="Chế độ hiển thị"
        >
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 px-3 h-10 text-sm ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/50"
            }`}
            aria-pressed={viewMode === "list"}
          >
            <IconList className="h-4 w-4" />
            Danh sách
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1.5 px-3 h-10 text-sm border-l ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/50"
            }`}
            aria-pressed={viewMode === "grid"}
          >
            <IconGrid className="h-4 w-4" />
            Thẻ
          </button>
        </div>
      </div>

      {/* Results — guard against the (rare but real) state where the
          query is briefly disabled (e.g. while a sibling useAuth() is
          still settling), so `data` is undefined and `isLoading` is
          false at the same time. */}
      {!data ? (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
          {debounced || branchId || generation
            ? `Không tìm thấy ai khớp bộ lọc.`
            : "Chưa có ai trong dòng họ. Bấm Thêm người để bắt đầu."}
        </div>
      ) : viewMode === "list" ? (
        <ul className="divide-y rounded-lg border bg-card">
          {data.rows.map((p) => (
            <PersonListItem key={p.id} person={p} clanId={clan.id} />
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.rows.map((p) => (
            <PersonGridCard key={p.id} person={p} clanId={clan.id} />
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

function metaLine(person: PersonRow): string {
  const parts: string[] = [];
  if (!person.is_living) {
    // List view stays compact: just the year, even if precision is finer.
    const dy = person.death_date?.slice(0, 4);
    parts.push(`đã mất${dy ? ` • ${dy}` : ""}`);
  } else {
    const by = person.birth_date?.slice(0, 4);
    if (by) parts.push(`sinh ${by}`);
  }
  if (person.generation !== null) parts.push(`Đời ${person.generation}`);
  return parts.join(" • ");
}


function PersonListItem({
  person,
  clanId,
}: {
  person: PersonRow;
  clanId: string;
}) {
  return (
    <li>
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className="block p-4 hover:bg-muted/40 transition-colors"
      >
        <p className="font-medium truncate">
          {person.full_name}
          {person.is_root && (
            <span className="ml-2 text-xs text-accent font-medium">
              Thuỷ tổ
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{metaLine(person)}</p>
      </Link>
    </li>
  );
}

function PersonGridCard({
  person,
  clanId,
}: {
  person: PersonRow;
  clanId: string;
}) {
  const initial = person.full_name.trim().charAt(0).toUpperCase() || "?";
  return (
    <li>
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className="flex flex-col items-center text-center gap-2 rounded-lg border bg-card p-3 hover:border-primary transition-colors h-full"
      >
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-full text-2xl font-medium ${
            person.gender === "F" ? "bg-accent/20" : "bg-primary/10"
          } ${person.is_living ? "" : "opacity-85"}`}
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="min-w-0 w-full">
          <p className="font-medium text-sm leading-tight truncate">
            {person.full_name}
          </p>
          {person.is_root && (
            <p className="text-[10px] text-accent font-medium mt-0.5">Thuỷ tổ</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {metaLine(person)}
          </p>
        </div>
      </Link>
    </li>
  );
}
