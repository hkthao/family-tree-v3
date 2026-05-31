import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { pickDefaultFocal, toFamilyChart } from "@/lib/familyChartAdapter";
import { fetchShareView } from "@/lib/queries/share-view";

import "family-chart/styles/family-chart.css";

interface F3Chart {
  setTransitionTime: (n: number) => F3Chart;
  updateTree: (opts: { initial?: boolean }) => void;
}

let f3Module: typeof import("family-chart") | null = null;
async function loadF3(): Promise<typeof import("family-chart")> {
  if (!f3Module) f3Module = await import("family-chart");
  return f3Module;
}

/**
 * /share/:token — read-only family tree for anonymous viewers. Calls the
 * Edge Function, which has already masked living persons' sensitive data.
 * No edit UI, no danh bạ, no PWA shell — just the tree on a clean page.
 */
export default function Share() {
  const { token } = useParams<{ token: string }>();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["share-view", token ?? ""],
    queryFn: () => fetchShareView(token!),
    enabled: !!token,
    retry: false,
  });

  const f3Data = useMemo(() => {
    if (!data) return null;
    // The share-view function already signed photo URLs for deceased
    // persons. Synthesize a path so the adapter's lookup table hits.
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
        birth_date: p.birth_date,
        death_date: p.death_date,
        generation: p.generation,
        birth_family_id: p.birth_family_id,
        photo_path: synthetic,
      };
    });
    return toFamilyChart(adapted, data.families, photoByPath);
  }, [data]);

  const focal = useMemo(
    () =>
      data
        ? pickDefaultFocal(
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
        photo_path: null,
            })),
          )
        : null,
    [data],
  );

  useEffect(() => {
    if (!containerRef.current || !f3Data || !focal) return;
    let disposed = false;
    const node = containerRef.current;

    (async () => {
      const f3 = await loadF3();
      if (disposed) return;
      node.innerHTML = "";
      try {
        const chart = (
          f3 as unknown as {
            createChart: (el: HTMLElement, data: unknown) => F3Chart;
          }
        ).createChart(node, f3Data).setTransitionTime(200);

        const ext = chart as F3Chart & {
          setCardSvg?: () => F3Chart;
          setCardDisplay?: (lines: string[][]) => F3Chart;
        };
        ext.setCardSvg?.();
        ext.setCardDisplay?.([["full name"], ["birthday"]]);

        chart.updateTree({ initial: true });
      } catch (err) {
        console.error("family-chart init failed", err);
      }
    })();

    return () => {
      disposed = true;
      node.innerHTML = "";
    };
  }, [f3Data, focal]);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b py-3 px-4">
        <h1 className="clan-name text-xl font-semibold text-center">
          Cây gia phả
        </h1>
        <p className="text-xs text-center text-muted-foreground mt-1">
          Đang xem qua liên kết chia sẻ — thông tin người còn sống đã được ẩn.
        </p>
      </header>

      <main className="flex-1 flex flex-col">
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
          <div
            ref={containerRef}
            className="flex-1 min-h-[480px]"
            aria-label="Cây gia phả tương tác (chỉ xem)"
          />
        )}
      </main>
    </div>
  );
}
