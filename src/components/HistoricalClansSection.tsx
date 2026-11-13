import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { IconSearch } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import {
  HISTORICAL_CATEGORY_LABEL,
  listHistoricalClans,
  type HistoricalCategory,
  type HistoricalClanSummary,
} from "@/lib/queries/historical";
import { unaccent } from "@/lib/unaccent";

import { t, msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
const PAGE_SIZE = 12;

export type HistoricalSort =
  "era_asc" | "era_desc" | "name" | "name_desc" | "people_desc" | "people_asc";
export function readHistoricalSort(): HistoricalSort {
  try {
    const v = localStorage.getItem(HISTORICAL_SORT_KEY);
    return HISTORICAL_SORTS.some((o) => o.value === v)
      ? (v as HistoricalSort)
      : "era_asc";
  } catch {
    return "era_asc";
  }
}

/** Năm bắt đầu lấy từ tên dạng "Nhà Lý (1009–1225)"; không có thì xếp cuối. */
function startYear(name: string): number {
  const m = /\((\d{3,4})\s*[–-]/.exec(name);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export const HISTORICAL_SORT_KEY = "family-tree:historical-sort";
export const HISTORICAL_SORTS: { value: HistoricalSort; label: string }[] =
  lazyMessages([
    { value: "era_asc", label: msg`Thời kỳ: cũ → mới` },
    { value: "era_desc", label: msg`Thời kỳ: mới → cũ` },
    { value: "name", label: msg`Tên A → Z` },
    { value: "name_desc", label: msg`Tên Z → A` },
    { value: "people_desc", label: msg`Nhiều người nhất` },
    { value: "people_asc", label: msg`Ít người nhất` },
  ]) as unknown as { value: HistoricalSort; label: string }[];

/**
 * Tab "Gia phả lịch sử" ở trang Dòng họ: dòng họ lịch sử (hoàng tộc, quý tộc,
 * quan lại – khoa bảng, võ tướng), tách khỏi bảng xếp hạng dòng họ thường.
 * Hiển thị theo đúng chế độ danh sách / lưới của trang (cùng kiểu dòng/thẻ);
 * lọc theo ô tìm kiếm (gõ không dấu cũng được) và chip nhóm.
 */
export function HistoricalClansSection({
  view,
  search,
  sort,
}: {
  view: "list" | "grid";
  search: string;
  sort: HistoricalSort;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["historical-clans"],
    queryFn: () => listHistoricalClans(),
    staleTime: 10 * 60 * 1000,
  });
  const [category, setCategory] = useState<HistoricalCategory | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, sort, category]);
  if (isLoading) return <LoadingState />;
  if (!data) return null;

  const present = (
    Object.keys(HISTORICAL_CATEGORY_LABEL) as HistoricalCategory[]
  ).filter((c) => data.some((d) => d.historical_category === c));
  const needle = unaccent(search.trim());
  const rows = data
    .filter(
      (d) =>
        (!category || d.historical_category === category) &&
        (!needle || unaccent(d.name).includes(needle)),
    )
    .sort((a, b) =>
      sort === "era_asc"
        ? startYear(a.name) - startYear(b.name) ||
          a.name.localeCompare(b.name, "vi")
        : sort === "era_desc"
          ? startYear(b.name) - startYear(a.name) ||
            a.name.localeCompare(b.name, "vi")
          : sort === "people_desc"
            ? b.person_count - a.person_count ||
              a.name.localeCompare(b.name, "vi")
            : sort === "people_asc"
              ? a.person_count - b.person_count ||
                a.name.localeCompare(b.name, "vi")
              : sort === "name_desc"
                ? b.name.localeCompare(a.name, "vi")
                : a.name.localeCompare(b.name, "vi"),
    );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const paged = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <section aria-label={t`Lịch sử`} className="space-y-3">
      {present.length > 1 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={t`Lọc theo nhóm`}
        >
          {[null, ...present].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={
                category === c
                  ? "rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground"
                  : "rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
              }
            >
              {c ? HISTORICAL_CATEGORY_LABEL[c] : "Tất cả"}
            </button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={
            search
              ? t`Không có mục lịch sử nào khớp "${search}"`
              : t`Chưa có mục lịch sử`
          }
          description={t`Thử bỏ bớt từ khoá hoặc chọn nhóm khác.`}
        />
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {paged.map((c) => (
            <HistoricalClanCard key={c.id} clan={c} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {paged.map((c) => (
            <HistoricalClanRow key={c.id} clan={c} />
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <Pagination
          page={current}
          totalPages={totalPages}
          total={rows.length}
          pageSize={PAGE_SIZE}
          unit={t`mục`}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}

function meta(clan: HistoricalClanSummary): string {
  return clan.historical_category
    ? HISTORICAL_CATEGORY_LABEL[clan.historical_category]
    : t`Lịch sử`;
}

const CATEGORY_CHIP: Record<HistoricalCategory, string> = {
  royal:
    "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  noble:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  official:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  military:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

/** Số người + nhóm, dạng chip màu căn sát phải. */
function ClanChips({
  clan,
  className,
}: {
  clan: HistoricalClanSummary;
  className?: string;
}) {
  const chip =
    "shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";
  return (
    <div
      className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
    >
      <div className="ml-auto flex w-max gap-1.5">
        <span
          className={`${chip} border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300`}
        >
          {clan.person_count.toLocaleString("vi-VN")} người
        </span>
        <span
          className={`${chip} ${CATEGORY_CHIP[clan.historical_category ?? "royal"]}`}
        >
          {meta(clan)}
        </span>
      </div>
    </div>
  );
}

/** Cùng kiểu với ClanRow ở trang Dòng họ (chế độ danh sách). */
function HistoricalClanRow({ clan }: { clan: HistoricalClanSummary }) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="block rounded-xl border bg-card shadow-sm px-4 py-3 hover:border-primary transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 min-w-0">
          <h3 className="clan-name text-lg font-semibold truncate">
            {clan.name}
          </h3>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mt-0.5">
            {clan.description}
          </p>
        )}
        <ClanChips clan={clan} className="mt-2" />
      </Link>
    </li>
  );
}

/** Cùng kiểu với ClanCard ở trang Dòng họ (chế độ lưới). */
function HistoricalClanCard({ clan }: { clan: HistoricalClanSummary }) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="flex h-full flex-col rounded-xl border bg-card shadow-sm p-3 sm:p-4 hover:border-primary transition-colors"
      >
        <div className="flex items-start justify-center gap-2 min-w-0">
          <h3 className="clan-name text-base font-semibold text-center leading-snug line-clamp-2 min-w-0">
            {clan.name}
          </h3>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm text-justify line-clamp-3 mt-1.5">
            {clan.description}
          </p>
        )}
        <ClanChips clan={clan} className="mt-auto pt-3" />
      </Link>
    </li>
  );
}
