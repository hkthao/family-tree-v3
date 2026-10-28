import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { IconScroll, IconUsers } from "@/components/icons";
import {
  HISTORICAL_CATEGORY_LABEL,
  listHistoricalClans,
  type HistoricalCategory,
  type HistoricalClanSummary,
} from "@/lib/queries/historical";

/**
 * Mục "Gia phả lịch sử" ở tab Cộng đồng: dòng họ lịch sử (hoàng tộc, quý tộc,
 * quan lại – khoa bảng, võ tướng) tách khỏi bảng xếp hạng dòng họ thường.
 * Hiển thị theo đúng chế độ danh sách / lưới của trang (cùng kiểu dòng/thẻ).
 * Không có dòng họ lịch sử nào → không hiện gì.
 */
export function HistoricalClansSection({ view }: { view: "list" | "grid" }) {
  const { data } = useQuery({
    queryKey: ["historical-clans"],
    queryFn: () => listHistoricalClans(),
    staleTime: 10 * 60 * 1000,
  });
  const [category, setCategory] = useState<HistoricalCategory | null>(null);
  if (!data || data.length === 0) return null;

  const present = (Object.keys(HISTORICAL_CATEGORY_LABEL) as HistoricalCategory[]).filter((c) =>
    data.some((d) => d.historical_category === c),
  );
  const rows = category ? data.filter((d) => d.historical_category === category) : data;

  return (
    <>
      <section aria-labelledby="historical-clans-title" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="historical-clans-title" className="inline-flex items-center gap-2 text-base font-semibold">
            <IconScroll className="h-5 w-5 text-primary" />
            Gia phả lịch sử
          </h2>
          {present.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo nhóm">
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
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Soạn từ chính sử, mỗi dữ kiện kèm trích dẫn nguyên văn. Không tính vào bảng xếp hạng dòng họ.
        </p>
        {view === "grid" ? (
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

      <h2 className="inline-flex items-center gap-2 pt-2 text-base font-semibold">
        <IconUsers className="h-5 w-5 text-primary" />
        Dòng họ cộng đồng
      </h2>
    </>
  );
}

function meta(clan: HistoricalClanSummary): string {
  return [
    clan.historical_category ? HISTORICAL_CATEGORY_LABEL[clan.historical_category] : "Gia phả lịch sử",
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
          <h3 className="clan-name text-lg font-semibold truncate">{clan.name}</h3>
          <span className="text-xs text-muted-foreground shrink-0">
            {clan.person_count.toLocaleString("vi-VN")} người
          </span>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mt-0.5">{clan.description}</p>
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
          <h3 className="clan-name text-base font-semibold leading-snug line-clamp-2 min-w-0">{clan.name}</h3>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mt-1.5">{clan.description}</p>
        )}
        <div className="mt-auto pt-3 text-xs text-muted-foreground">
          <p>{clan.person_count.toLocaleString("vi-VN")} người</p>
          <p className="mt-0.5">{meta(clan)}</p>
        </div>
      </Link>
    </li>
  );
}
