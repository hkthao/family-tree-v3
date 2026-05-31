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
  // setCardSvg / setCardHtml return a NEW Card instance (CardSvg /
  // CardHtml), not the Chart. Configuration like setCardDisplay,
  // setCardDim etc. lives on that returned instance — calling them
  // on the Chart silently no-ops (which is what was hiding the card
  // text before).
  setCardSvg?: () => F3Card;
  setCardHtml?: () => F3Card;
}

interface F3Card {
  setCardDisplay: (lines: (CardDisplayFn | string | string[])[]) => F3Card;
  setCardDim: (dim: { w?: number; h?: number; img_w?: number; img_h?: number; img_x?: number; img_y?: number; text_x?: number; text_y?: number }) => F3Card;
  setCardImageField?: (field: string) => F3Card;
  setOnCardUpdate: (fn: OnCardUpdateFn) => F3Card;
}

type OnCardUpdateFn = (this: SVGGElement, d: { data?: DatumNode }) => void;

/**
 * Shape that family-chart's display function receives — the whole
 * datum {id, data, rels}, not just the inner field bag. The library
 * does `cd(d.data)` where `d` is the d3 node, so `d.data` is our
 * outer datum and `d.data.data` is the field bag.
 */
interface DatumNode {
  id?: string;
  data?: Record<string, unknown>;
  rels?: unknown;
}
type CardDisplayFn = (d: DatumNode) => string;

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

        // setCardSvg returns a CardSvg instance — every config call
        // (setCardDisplay, setCardDim, …) must chain off THAT, not the
        // Chart. Calling them on the Chart silently no-ops which is
        // what was hiding the card text before.
        //
        // Function form of setCardDisplay receives the OUTER datum
        // ({id, data, rels}); fields live under `.data`. String
        // entries also work — the library wraps them as
        // d1 => d1.data[key] internally.
        const card = (built as F3Chart & {
          setCardSvg?: () => F3Card;
        }).setCardSvg?.();

        // Display: name on line 1 (left-aligned by default); lifespan
        // "YYYY - YYYY" on line 2 (centered via the onCardUpdate hook
        // below — the library hard-codes x=0 on every tspan, so we
        // post-process). Unknown years render as "?".
        const lifespan = (d: DatumNode): string => {
          const f = d.data ?? {};
          const b = (f["birthday"] as string) || "?";
          const isLiving = f["is_living"] !== false;
          const death = (f["death_year"] as string) || (isLiving ? "" : "?");
          return death ? `${b} - ${death}` : b;
        };

        card
          ?.setCardDisplay([
            (d) => String((d as DatumNode).data?.["full name"] ?? ""),
            (d) => lifespan(d as DatumNode),
          ])
          // Wider card so Vietnamese full names ("Huỳnh Thanh Châu")
          // fit; a touch taller so the two text lines breathe.
          // Tighter card: 50px circular avatar with small inset, text
          // starts at x=64 so name + meta line take the remaining
          // ~190px. h=72 keeps both rows close without crowding the
          // generation badge in the corner.
          .setCardDim({
            w: 260,
            h: 72,
            text_x: 64,
            text_y: 20,
            img_w: 50,
            img_h: 50,
            img_x: 8,
            img_y: 11,
          })
          .setOnCardUpdate(function (d) {
            const fields = (d.data as DatumNode | undefined)?.data ?? {};
            const tspans = this.querySelectorAll<SVGTSpanElement>(
              ".card-text text tspan",
            );
            const meta = tspans[1];
            if (meta) {
              // Left-aligned meta line, slightly more vertical breathing.
              meta.setAttribute("text-anchor", "start");
              meta.setAttribute("x", "0");
              meta.setAttribute("dy", "18");
            }
            // Generation badge — small pill in the top-right corner.
            const gen = fields["generation"];
            if (typeof gen === "number" && gen > 0) {
              const existing = this.querySelector(".gen-badge");
              if (existing) existing.remove();
              const badge = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "g",
              );
              badge.setAttribute("class", "gen-badge");
              badge.innerHTML = `
                <rect x="212" y="6" width="42" height="18" rx="9"
                      fill="#7A2E2E" />
                <text x="233" y="19" text-anchor="middle"
                      fill="#FFFFFF" font-size="10" font-weight="700">
                  Đời ${gen}
                </text>`;
              this.querySelector(".card-body")?.appendChild(badge);
            }
          });

        // Spacing tuned to the new 260×72 card. Default 250/150 was
        // tight for our 220-wide Vietnamese-name cards; 260 cards
        // need ~290 horizontally and 150 vertically still works.
        built
          .setTransitionTime(200)
          .setCardXSpacing(290)
          .setCardYSpacing(160);

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
            //
            // CSS-var overrides shift the default saturated blue/pink card
            // fills toward the paper/oxblood palette from plan §10:
            // male = cool muted, female = warm muted, text in ink colour.
            className="f3 rounded-lg border bg-card overflow-hidden -mx-4 sm:mx-0 h-[70vh] min-h-[480px] max-h-[820px] text-foreground"
            style={
              {
                "--male-color": "#D4DDE4",
                "--female-color": "#E8D2CC",
                "--genderless-color": "#E8E0D2",
              } as React.CSSProperties
            }
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
