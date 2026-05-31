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
import { PersonAvatar } from "@/components/PersonAvatar";
import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { listBranches } from "@/lib/queries/branches";
import { getClanStats } from "@/lib/queries/clan-stats";
import { queryKeys } from "@/lib/queries/keys";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Danh bạ</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
          {canEdit && (
            <Button asChild size="sm">
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
            <PersonListItem
              key={p.id}
              person={p}
              clanId={clan.id}
              relatives={relatives}
              photoUrl={p.photo_path ? (photoUrls?.get(p.photo_path) ?? null) : null}
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
}: {
  person: PersonRow;
  clanId: string;
  relatives: RelativesIndex | undefined;
  photoUrl: string | null;
}) {
  const rel = lookupRelatives(person.id, relatives);
  const life = lifespan(person);
  const metaBits = [genderLabel(person.gender)];
  if (life) metaBits.push(life);
  if (person.generation !== null) metaBits.push(`Đời ${person.generation}`);

  return (
    <li>
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors"
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
    </li>
  );
}

function PersonGridCard({
  person,
  clanId,
  relatives,
  photoUrl,
}: {
  person: PersonRow;
  clanId: string;
  relatives: RelativesIndex | undefined;
  photoUrl: string | null;
}) {
  const rel = lookupRelatives(person.id, relatives);
  const life = lifespan(person);

  return (
    <li>
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className="flex flex-col items-center text-center gap-2 rounded-lg border bg-card p-3 hover:border-primary transition-colors h-full"
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
