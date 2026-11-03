import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { IconSearch } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import {
  HISTORICAL_CATEGORY_LABEL,
  listHistoricalClans,
  type HistoricalCategory,
  type HistoricalClanSummary,
} from "@/lib/queries/historical";
import { unaccent } from "@/lib/unaccent";

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
export const HISTORICAL_SORTS: { value: HistoricalSort; label: string }[] = [
  { value: "era_asc", label: "Thời kỳ: cũ → mới" },
  { value: "era_desc", label: "Thời kỳ: mới → cũ" },
  { value: "name", label: "Tên A → Z" },
  { value: "name_desc", label: "Tên Z → A" },
  { value: "people_desc", label: "Nhiều người nhất" },
  { value: "people_asc", label: "Ít người nhất" },
];

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

  return (
    <section aria-label="Lịch sử" className="space-y-3">
      {present.length > 1 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Lọc theo nhóm"
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
              ? `Không có mục lịch sử nào khớp "${search}"`
              : "Chưa có mục lịch sử"
          }
          description="Thử bỏ bớt từ khoá hoặc chọn nhóm khác."
        />
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {rows.map((c) => (
            <HistoricalClanCard key={c.id} clan={c} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <HistoricalClanRow key={c.id} clan={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function meta(clan: HistoricalClanSummary): string {
  return clan.historical_category
    ? HISTORICAL_CATEGORY_LABEL[clan.historical_category]
    : "Lịch sử";
}

/** Cùng kiểu với ClanRow ở trang Dòng họ (chế độ danh sách). */
function HistoricalClanRow({ clan }: { clan: HistoricalClanSummary }) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="block rounded-lg border bg-card px-4 py-3 hover:border-primary transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 min-w-0">
          <h3 className="clan-name text-lg font-semibold truncate">
            {clan.name}
          </h3>
          <span className="text-xs text-muted-foreground shrink-0">
            {clan.person_count.toLocaleString("vi-VN")} người
          </span>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mt-0.5">
            {clan.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{meta(clan)}</p>
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
        className="flex h-full flex-col rounded-lg border bg-card p-3 sm:p-4 hover:border-primary transition-colors"
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
        <div className="mt-auto pt-3 text-xs text-muted-foreground">
          <p>{clan.person_count.toLocaleString("vi-VN")} người</p>
          <p className="mt-0.5">{meta(clan)}</p>
        </div>
      </Link>
    </li>
  );
}
