import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { RefreshButton } from "@/components/RefreshButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import { listPersons, type PersonRow } from "@/lib/queries/persons";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function People() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  const params = { page, pageSize, search: debounced };

  const { data, isFetching, isLoading } = useQuery({
    queryKey: queryKeys.persons(clan.id, userId, params),
    queryFn: () => listPersons(clan.id, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canEdit = clan.myRole === "admin" || clan.myRole === "editor";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Danh bạ</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
          {canEdit && (
            <Button asChild>
              <Link to={`/clans/${clan.id}/people/new`}>+ Thêm người</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="search">Tìm theo tên (gõ không dấu cũng được)</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vd: nguyen van"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">Đang tải…</p>
        ) : data && data.rows.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">
            {debounced
              ? `Không tìm thấy ai khớp "${debounced}".`
              : "Chưa có ai trong dòng họ. Bấm Thêm người để bắt đầu."}
          </p>
        ) : (
          <ul className="divide-y">
            {data!.rows.map((p) => (
              <PersonItem key={p.id} person={p} clanId={clan.id} />
            ))}
          </ul>
        )}
      </div>

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
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
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
            ← Trước
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
            Sau →
          </Button>
        </div>
      </div>
    </div>
  );
}

function PersonItem({ person, clanId }: { person: PersonRow; clanId: string }) {
  const birthYear = person.birth_date?.slice(0, 4);
  const deathYear = person.death_date?.slice(0, 4);

  return (
    <li>
      <Link
        to={`/clans/${clanId}/people/${person.id}`}
        className="block p-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium truncate">
              {person.full_name}
              {person.is_root && (
                <span className="ml-2 text-xs text-accent font-medium">
                  Thuỷ tổ
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {!person.is_living && (
                <span>
                  đã mất
                  {deathYear ? ` • ${deathYear}` : ""}
                  {" • "}
                </span>
              )}
              {person.generation !== null && <>Đời {person.generation}</>}
              {birthYear && person.is_living && (
                <>
                  {person.generation !== null && " • "}
                  sinh {birthYear}
                </>
              )}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

