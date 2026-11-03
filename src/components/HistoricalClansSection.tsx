import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { IconScroll, IconSearch } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import {
  HISTORICAL_CATEGORY_LABEL,
  listHistoricalClans,
  type HistoricalCategory,
  type HistoricalClanSummary,
} from "@/lib/queries/historical";
import { unaccent } from "@/lib/unaccent";

type SortKey = "name" | "name_desc" | "people_desc" | "people_asc";
const SORT_KEY = "family-tree:historical-sort";
const SORTS: { value: SortKey; label: string }[] = [
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
}: {
  view: "list" | "grid";
  search: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["historical-clans"],
    queryFn: () => listHistoricalClans(),
    staleTime: 10 * 60 * 1000,
  });
  const [category, setCategory] = useState<HistoricalCategory | null>(null);
  const [sort, setSort] = useState<SortKey>(() => {
    try {
      const v = localStorage.getItem(SORT_KEY);
      return SORTS.some((o) => o.value === v) ? (v as SortKey) : "name";
    } catch {
      return "name";
    }
  });
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
      sort === "people_desc"
        ? b.person_count - a.person_count || a.name.localeCompare(b.name, "vi")
        : sort === "people_asc"
          ? a.person_count - b.person_count ||
            a.name.localeCompare(b.name, "vi")
          : sort === "name_desc"
            ? b.name.localeCompare(a.name, "vi")
            : a.name.localeCompare(b.name, "vi"),
    );
  const changeSort = (v: SortKey) => {
    setSort(v);
    try {
      localStorage.setItem(SORT_KEY, v);
    } catch {
      /* bỏ qua */
    }
  };

  return (
    <section aria-label="Lịch sử" className="space-y-3">
      <p className="text-xs text-muted-foreground -mt-1">
        Soạn từ chính sử, mỗi dữ kiện kèm trích dẫn nguyên văn. Không tính vào
        bảng xếp hạng dòng họ.
      </p>
      <div className="flex flex-wrap items-start justify-between gap-2">
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
        ) : (
          <span />
        )}
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Sắp xếp
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as SortKey)}
            className="rounded-md border bg-card px-2 py-1 text-sm text-foreground"
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
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
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
  return [
    clan.historical_category
      ? HISTORICAL_CATEGORY_LABEL[clan.historical_category]
      : "Lịch sử",
    "Có trích dẫn nguồn",
  ].join(" • ");
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
        className="flex h-full flex-col rounded-lg border bg-card p-4 hover:border-primary transition-colors"
      >
        <div className="flex items-start gap-2 min-w-0">
          <IconScroll className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <h3 className="clan-name text-base font-semibold leading-snug line-clamp-2 min-w-0">
            {clan.name}
          </h3>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mt-1.5">
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
