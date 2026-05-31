import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { pickDefaultFocal, toFamilyChart } from "@/lib/familyChartAdapter";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";

import "family-chart/styles/family-chart.css";

interface F3Chart {
  setCardYSpacing: (n: number) => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setOrientationHorizontal?: () => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setTransitionTime: (n: number) => F3Chart;
  setSingleParentEmptyCard: (b: boolean) => F3Chart;
  updateTree: (opts: { initial?: boolean }) => void;
  setCard?: (Card: unknown) => F3Chart;
  // Method names vary across family-chart versions; we use whatever exists.
}

// Lazy import — family-chart pulls in d3 (big), don't ship to login bundle.
let f3Module: typeof import("family-chart") | null = null;
async function loadF3(): Promise<typeof import("family-chart")> {
  if (!f3Module) f3Module = await import("family-chart");
  return f3Module;
}

export default function Tree() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [focal, setFocal] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });

  const f3Data = useMemo(() => {
    if (!data) return null;
    return toFamilyChart(data.persons, data.families);
  }, [data]);

  // Pick default focal once data lands
  useEffect(() => {
    if (data && focal === null) {
      setFocal(pickDefaultFocal(data.persons));
    }
  }, [data, focal]);

  // Initialize / re-render the family-chart instance
  useEffect(() => {
    if (!containerRef.current || !f3Data || !focal) return;

    let disposed = false;
    const node = containerRef.current;

    (async () => {
      const f3 = await loadF3();
      if (disposed) return;

      // Clear previous render
      node.innerHTML = "";

      try {
        const chart = (f3 as unknown as {
          createChart: (el: HTMLElement | string, data: unknown) => F3Chart;
          CardSvg: unknown;
        })
          .createChart(node, f3Data)
          .setTransitionTime(200);

        // SVG card for mobile (lighter than HTML cards)
        const maybeWithCard = chart as F3Chart & {
          setCardSvg?: () => F3Chart;
          setCardDisplay?: (lines: string[][]) => F3Chart;
        };
        if (typeof maybeWithCard.setCardSvg === "function") {
          maybeWithCard.setCardSvg();
        }
        if (typeof maybeWithCard.setCardDisplay === "function") {
          maybeWithCard.setCardDisplay([["full name"], ["birthday"]]);
        }

        chart.updateTree({ initial: true });
      } catch (err) {
        // family-chart API surface varies; keep going with whatever rendered.
        console.error("family-chart init failed:", err);
      }
    })();

    return () => {
      disposed = true;
      node.innerHTML = "";
    };
  }, [f3Data, focal]);

  // Search-by-name → set focal
  const matches = useMemo(() => {
    if (!data || !search.trim()) return [];
    const needle = search.toLowerCase().trim();
    return data.persons
      .filter((p) => p.full_name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Cây gia phả</h2>
        <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
      </div>

      {isLoading && (
        <p className="text-muted-foreground">Đang tải cây…</p>
      )}

      {!isLoading && data && data.persons.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chưa có dữ liệu</CardTitle>
            <CardDescription>
              Hãy thêm người trong Danh bạ để bắt đầu xây dựng cây gia phả.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}

      {data && data.persons.length > 0 && (
        <>
          <div className="space-y-2">
            <SearchInput
              label="Đặt người trung tâm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Đặt người trung tâm — gõ tên để tìm…"
            />
            {matches.length > 0 && (
              <ul className="rounded-md border bg-card divide-y">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/40"
                      onClick={() => {
                        setFocal(m.id);
                        setSearch("");
                      }}
                    >
                      <span className="font-medium">{m.full_name}</span>
                      {m.generation !== null && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          Đời {m.generation}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            ref={containerRef}
            className="rounded-lg border bg-card overflow-hidden min-h-[480px] -mx-4 sm:mx-0"
            aria-label="Cây gia phả tương tác"
          />
          <p className="text-xs text-muted-foreground">
            Vuốt để di chuyển, kéo 2 ngón để phóng to/thu nhỏ. Chạm vào thẻ
            người để mở rộng nhánh.
          </p>
        </>
      )}
    </div>
  );
}
