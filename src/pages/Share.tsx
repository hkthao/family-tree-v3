import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
  IconLayoutHorizontal,
  IconLayoutVertical,
} from "@/components/icons";
import { SearchInput } from "@/components/SearchInput";
import { SharedPersonCard } from "@/components/SharedPersonCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { pickDefaultFocal, toFamilyChart } from "@/lib/familyChartAdapter";
import { fetchShareView } from "@/lib/queries/share-view";

import "family-chart/styles/family-chart.css";

type DatumNode = {
  id?: string;
  data?: Record<string, unknown>;
};

interface F3Card {
  setCardDisplay: (
    lines: ((d: unknown) => string)[] | string[][],
  ) => F3Card;
  setCardDim: (dim: {
    w?: number;
    h?: number;
    img_w?: number;
    img_h?: number;
    img_x?: number;
    img_y?: number;
    text_x?: number;
    text_y?: number;
  }) => F3Card;
  setOnCardUpdate: (
    fn: (this: SVGGElement, d: { data?: DatumNode }) => void,
  ) => F3Card;
}

interface F3Chart {
  setTransitionTime: (n: number) => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setCardYSpacing: (n: number) => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setOrientationHorizontal?: () => F3Chart;
  updateTree: (opts: { initial?: boolean }) => void;
  updateMainId?: (id: string) => void;
}

type Orientation = "vertical" | "horizontal";

let f3Module: typeof import("family-chart") | null = null;
async function loadF3(): Promise<typeof import("family-chart")> {
  if (!f3Module) f3Module = await import("family-chart");
  return f3Module;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

/**
 * /share/:token — read-only family tree for anonymous viewers. Calls the
 * Edge Function, which has already masked living persons' sensitive data.
 * Filters: search-to-focal + vertical/horizontal orientation.
 */
export default function Share() {
  const { token } = useParams<{ token: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3Chart | null>(null);

  // `focal` starts as null and becomes the user's choice (or a default
  // picked from the data) once we have it. We don't gate the chart on
  // it — family-chart picks its own default main when none is set.
  const [focal, setFocal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("vertical");

  const { data, isLoading, error } = useQuery({
    queryKey: ["share-view", token ?? ""],
    queryFn: () => fetchShareView(token!),
    enabled: !!token,
    retry: false,
  });

  // Pick a default focal synchronously the moment data lands — using
  // a setState-inside-render guard (only fires once) instead of an
  // async useEffect, so the chart inits with the right main on the
  // very first paint instead of racing the focal computation.
  if (data && focal === null) {
    const def = pickDefaultFocal(
      data.persons.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        gender: p.gender,
        is_living: p.is_living,
        is_root: p.is_root,
        birth_date: p.birth_date,
        death_date: p.death_date,
        generation: p.generation,
        birth_family_id: p.birth_family_id,
        branch_id: null,
        photo_path: null,
      })),
    );
    if (def) setFocal(def);
  }

  const f3Data = useMemo(() => {
    if (!data) return null;
    const photoByPath = new Map<string, string>();
    const adapted = data.persons.map((p) => {
      const synthetic = p.photo_url ? `share/${p.id}` : null;
      if (synthetic && p.photo_url) photoByPath.set(synthetic, p.photo_url);
      return {
        id: p.id,
        full_name: p.full_name,
        gender: p.gender,
        is_living: p.is_living,
        is_root: p.is_root,
        birth_order: p.birth_order,
        birth_date: p.birth_date,
        death_date: p.death_date,
        generation: p.generation,
        birth_family_id: p.birth_family_id,
        branch_id: null,
        photo_path: synthetic,
      };
    });
    return toFamilyChart(adapted, data.families, photoByPath);
  }, [data]);

  // (Re-)initialise the chart on orientation change. Focal updates do
  // NOT re-init — we call chart.updateMainId() instead so the camera
  // smoothly pans/zooms to the new centre.
  useEffect(() => {
    if (!containerRef.current || !f3Data) return;
    let disposed = false;
    const node = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const f3 = await loadF3();
      if (disposed) return;
      node.innerHTML = "";
      try {
        const built = (
          f3 as unknown as {
            createChart: (el: HTMLElement, data: unknown) => F3Chart;
          }
        ).createChart(node, f3Data);

        const card = (built as F3Chart & {
          setCardSvg?: () => F3Card;
        }).setCardSvg?.();

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
          .setCardDim({
            w: 220,
            h: 64,
            text_x: 64,
            text_y: 18,
            img_w: 50,
            img_h: 50,
            img_x: 8,
            img_y: 7,
          })
          .setOnCardUpdate(function (d) {
            const datum = d.data as DatumNode | undefined;
            const fields = datum?.data ?? {};

            const tspans = this.querySelectorAll<SVGTSpanElement>(
              ".card-text text tspan",
            );
            const meta = tspans[1];
            if (meta) {
              meta.setAttribute("text-anchor", "start");
              meta.setAttribute("x", "0");
              meta.setAttribute("dy", "18");
            }

            const gen = fields["generation"];
            if (typeof gen === "number" && gen > 0) {
              this.querySelector(".gen-badge")?.remove();
              const badge = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "g",
              );
              badge.setAttribute("class", "gen-badge");
              badge.innerHTML = `
                <rect x="172" y="6" width="42" height="18" rx="9"
                      fill="#7A2E2E" />
                <text x="193" y="19" text-anchor="middle"
                      fill="#FFFFFF" font-size="10" font-weight="700">
                  Đời ${gen - (data?.generation_offset ?? 0)}
                </text>`;
              this.querySelector(".card-body")?.appendChild(badge);
            }
          });

        built.setTransitionTime(200);
        if (orientation === "horizontal") {
          built.setOrientationHorizontal?.();
          built.setCardXSpacing(280).setCardYSpacing(92);
        } else {
          built.setOrientationVertical?.();
          built.setCardXSpacing(250).setCardYSpacing(152);
        }

        if (focal && built.updateMainId) built.updateMainId(focal);

        // Wait one paint frame so the browser has actually laid the
        // container out — otherwise treeFit anchors at the top-left
        // and cards stay tiny on first render.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        if (disposed) return;
        built.updateTree({ initial: true });
        chartRef.current = built;

        if (typeof ResizeObserver !== "undefined") {
          let last = node.getBoundingClientRect().width;
          resizeObserver = new ResizeObserver(() => {
            const next = node.getBoundingClientRect().width;
            if (Math.abs(next - last) < 1) return;
            last = next;
            chartRef.current?.updateTree({ initial: false });
          });
          resizeObserver.observe(node);
        }
      } catch (err) {
        console.error("family-chart init failed", err);
      }
    })();

    return () => {
      disposed = true;
      chartRef.current = null;
      resizeObserver?.disconnect();
      node.innerHTML = "";
    };
  }, [f3Data, orientation, data?.generation_offset]);

  // Smoothly re-centre when focal changes without re-creating the chart.
  useEffect(() => {
    if (!focal) return;
    chartRef.current?.updateMainId?.(focal);
    chartRef.current?.updateTree({ initial: false });
  }, [focal]);

  // Search → top 5 matches by normalised name.
  const matches = useMemo(() => {
    if (!data || !search.trim()) return [];
    const needle = normalize(search.trim());
    return data.persons
      .filter((p) => normalize(p.full_name).includes(needle))
      .slice(0, 5);
  }, [data, search]);

  // Personal QR branch — bypass the family-chart and render a card.
  // The focal is whichever person matches data.root_person_id (always
  // set when scope='single_person').
  if (data && data.scope === "single_person") {
    const focalPerson = data.root_person_id
      ? data.persons.find((p) => p.id === data.root_person_id)
      : null;
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b py-3 px-4 shrink-0">
          <h1 className="clan-name text-xl font-semibold text-center">
            Trang cá nhân
          </h1>
          <p className="text-xs text-center text-muted-foreground mt-1">
            Đang xem qua liên kết chia sẻ.
          </p>
        </header>
        <main className="flex-1 min-h-0">
          {focalPerson ? (
            <SharedPersonCard
              focal={focalPerson}
              persons={data.persons}
              families={data.families}
              genOffset={data.generation_offset ?? 0}
              clanId={data.clan_id}
              shareToken={token}
              restingPlaces={data.resting_places}
            />
          ) : (
            <p className="p-8 text-center text-muted-foreground">
              Không tìm thấy thông tin người này.
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background flex flex-col">
      <header className="border-b py-3 px-4 shrink-0">
        <h1 className="clan-name text-xl font-semibold text-center">
          Cây gia phả
        </h1>
        <p className="text-xs text-center text-muted-foreground mt-1">
          Đang xem qua liên kết chia sẻ — thông tin người còn sống đã được ẩn.
        </p>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        {isLoading && (
          <p className="p-8 text-center text-muted-foreground">Đang tải…</p>
        )}
        {error && (
          <div className="p-4 max-w-md mx-auto w-full">
            <Alert variant="destructive">
              <AlertDescription>
                {(error as Error).message}
              </AlertDescription>
            </Alert>
          </div>
        )}
        {data && data.persons.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            Chưa có dữ liệu trong dòng họ.
          </p>
        )}
        {data && data.persons.length > 0 && (
          <>
            {/* Filter toolbar */}
            <div className="border-b px-4 py-3 shrink-0 flex flex-wrap items-start gap-3 print-hide">
              <div className="flex-1 min-w-[200px] max-w-md relative">
                <SearchInput
                  label="Đặt người trung tâm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Đặt người trung tâm — gõ tên để tìm…"
                />
                {matches.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border bg-card divide-y shadow-md">
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
                          <p className="font-medium">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.gender === "M" ? "Nam" : "Nữ"}
                            {m.birth_date
                              ? ` · sinh ${m.birth_date.slice(0, 4)}`
                              : ""}
                            {m.generation !== null
                              ? ` · Đời ${m.generation - (data.generation_offset ?? 0)}`
                              : ""}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <SegmentedControl ariaLabel="Hướng cây">
                <SegmentedButton
                  active={orientation === "vertical"}
                  onClick={() => setOrientation("vertical")}
                  className="inline-flex items-center gap-1.5 px-3"
                >
                  <IconLayoutVertical className="h-4 w-4" />
                  Dọc
                </SegmentedButton>
                <SegmentedButton
                  active={orientation === "horizontal"}
                  onClick={() => setOrientation("horizontal")}
                  className="inline-flex items-center gap-1.5 px-3"
                >
                  <IconLayoutHorizontal className="h-4 w-4" />
                  Ngang
                </SegmentedButton>
              </SegmentedControl>
            </div>

            <div
              ref={containerRef}
              className="f3 flex-1 min-h-0 w-full text-foreground"
              style={
                {
                  "--male-color": "var(--tree-card-male)",
                  "--female-color": "var(--tree-card-female)",
                } as React.CSSProperties
              }
              aria-label="Cây gia phả tương tác (chỉ xem)"
            />
          </>
        )}
      </main>
    </div>
  );
}
