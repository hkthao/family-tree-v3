import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { IconScroll } from "@/components/icons";
import {
  HISTORICAL_CATEGORY_LABEL,
  listHistoricalClans,
  type HistoricalCategory,
} from "@/lib/queries/historical";

/**
 * Mục "Gia phả lịch sử" ở tab Cộng đồng: dòng họ lịch sử (hoàng tộc, quý tộc,
 * quan lại – khoa bảng, võ tướng) tách khỏi bảng xếp hạng dòng họ thường.
 * Không có dòng họ lịch sử nào → không hiện gì.
 */
export function HistoricalClansSection() {
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
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((c) => (
          <Link
            key={c.id}
            to={`/clans/${c.id}`}
            className="flex h-full flex-col rounded-lg border bg-card p-4 hover:border-primary transition-colors"
          >
            <p className="clan-name text-base font-semibold leading-snug line-clamp-2">{c.name}</p>
            {c.description && <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
            <p className="mt-auto pt-3 text-xs text-muted-foreground">
              {c.historical_category ? `${HISTORICAL_CATEGORY_LABEL[c.historical_category]} · ` : ""}
              {c.person_count} người
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
