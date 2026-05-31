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
    let chart: F3Chart | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const f3 = await loadF3();
      if (disposed) return;

      node.innerHTML = "";

      try {
        const built = (
          f3 as unknown as {
            createChart: (el: HTMLElement | string, data: unknown) => F3Chart;
          }
        ).createChart(node, f3Data);

        const ext = built as F3Chart & {
          setCardSvg?: () => F3Chart;
          setCardDisplay?: (lines: string[][]) => F3Chart;
          setCardDim?: (dim: { w?: number; h?: number }) => F3Chart;
        };

        // SVG cards are lighter than HTML cards on mobile and let us
        // size them explicitly. Default 200×80 is fine for the cards
        // themselves; the issue was layout fit, not card size.
        ext.setCardSvg?.();
        ext.setCardDisplay?.([["full name"], ["birthday"]]);
        ext.setCardDim?.({ w: 220, h: 70 });
        built.setTransitionTime(200);

        // updateTree({ initial: true }) calls treeFit which measures the
        // SVG via getBoundingClientRect. Wait one paint frame so the
        // browser has actually laid the container out — otherwise the
        // initial fit anchors at the top-left and cards stay tiny.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        if (disposed) return;
        built.updateTree({ initial: true });
        chart = built;

        // Re-fit on container resize (window resize, drawer expand/collapse,
        // orientation change). family-chart's updateTree with no `initial`
        // and tree_position='fit' (the default) re-runs the same fit math.
        if (typeof ResizeObserver !== "undefined") {
          let last = node.getBoundingClientRect().width;
          resizeObserver = new ResizeObserver(() => {
            const next = node.getBoundingClientRect().width;
            if (Math.abs(next - last) < 1) return; // ignore sub-pixel noise
            last = next;
            chart?.updateTree({ initial: false });
          });
          resizeObserver.observe(node);
        }
      } catch (err) {
        console.error("family-chart init failed:", err);
      }
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
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
            // The `f3` class is required — family-chart's stylesheet scopes
            // `svg.main_svg { width:100%; height:100% }` under it. Without
            // the class, the SVG (and the f3Canvas it lives in) renders at
            // intrinsic size and the cards clump in the corner.
            className="f3 rounded-lg border bg-card overflow-hidden -mx-4 sm:mx-0 h-[70vh] min-h-[480px] max-h-[820px]"
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
