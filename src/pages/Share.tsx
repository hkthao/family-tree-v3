import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";

import {
  IconLayoutHorizontal,
  IconLayoutVertical,
  IconMaximize,
  IconMinimize,
} from "@/components/icons";
import { track } from "@/lib/analytics";
import type { TreeData } from "@/lib/queries/tree";

// Lazy — kéo three.js + 3d-force-graph ra chunk riêng, chỉ tải khi bật 3D.
const Tree3DView = lazy(() =>
  import("@/components/Tree3DView").then((m) => ({ default: m.Tree3DView })),
);
import { SearchInput } from "@/components/SearchInput";
import { SharedPersonCard } from "@/components/SharedPersonCard";
import { SharedRestingPlaceCard } from "@/components/SharedRestingPlaceCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { pickDefaultFocal, toFamilyChart } from "@/lib/familyChartAdapter";
import { fetchPublicClanView, fetchShareView } from "@/lib/queries/share-view";
import { HERITAGE_CATEGORY_LABEL, videoEmbedUrl } from "@/lib/queries/heritage";

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
  setProgenyDepth?: (n: number) => F3Chart;
  setAncestryDepth?: (n: number) => F3Chart;
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
  // Hai nguồn: /share/:token (link chia sẻ) HOẶC /xem/clans/:clanId (xem trước
  // công khai dòng họ, không cần đăng nhập). clanId → luôn là cây (tree_view).
  const { token, clanId } = useParams<{ token?: string; clanId?: string }>();
  const publicClan = !token && !!clanId;
  const containerRef = useRef<HTMLDivElement>(null);
  const shareWrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3Chart | null>(null);
  // Toàn màn hình bằng OVERLAY CSS (fixed inset-0) — KHÔNG dùng Fullscreen
  // API vì iOS Safari không cho fullscreen phần tử thường. Chạy mọi nơi.
  const [isFullscreen, setIsFullscreen] = useState(false);
  function toggleFullscreen() {
    setIsFullscreen((v) => !v);
  }
  useEffect(() => {
    const refit = requestAnimationFrame(() =>
      chartRef.current?.updateTree({ initial: false }),
    );
    if (!isFullscreen) return () => cancelAnimationFrame(refit);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(refit);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  // `focal` starts as null and becomes the user's choice (or a default
  // picked from the data) once we have it. We don't gate the chart on
  // it — family-chart picks its own default main when none is set.
  const [focal, setFocal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Chế độ cây: 2D (family-chart) | 3D (Tree3DView). Áp cho cả share-link lẫn
  // trang xem trước công khai.
  const [treeMode, setTreeMode] = useState<"2d" | "3d">("2d");
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  // Số đời hiển thị quanh người làm tâm — mặc định 3 để họ lớn không
  // render toàn bộ gây lag trên điện thoại. 0 = tất cả.
  const [depth, setDepth] = useState<number>(3);
  const DEPTH_OPTIONS = [3, 4, 5, 0] as const;

  const { data, isLoading, error } = useQuery({
    queryKey: ["share-view", token ?? `clan:${clanId}`],
    queryFn: () =>
      publicClan ? fetchPublicClanView(clanId!) : fetchShareView(token!),
    enabled: !!token || !!clanId,
    retry: false,
  });

  // Đo lượt xem: trang công khai (khách chưa đăng nhập) vs link chia sẻ.
  useEffect(() => {
    if (!data) return;
    if (publicClan) track("public_clan_viewed");
    else track("share_viewed", { scope: data.scope });
  }, [data, publicClan]);

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

  // Dữ liệu cho cây 3D (Tree3DView nhận qua props vì khách chưa đăng nhập không
  // fetch DB được). Ảnh dùng key tổng hợp "share/<id>" → map sang URL đã ký.
  const tree3dData: TreeData | null = useMemo(() => {
    if (!data) return null;
    return {
      persons: data.persons.map((p) => ({
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
        photo_path: p.photo_url ? `share/${p.id}` : null,
      })),
      families: data.families.map((f) => ({
        id: f.id,
        husband_id: f.husband_id,
        wife_id: f.wife_id,
        spouse_order: f.spouse_order,
        created_at: f.created_at,
      })),
    };
  }, [data]);
  const tree3dPhotos = useMemo(() => {
    const m = new Map<string, string>();
    if (data)
      for (const p of data.persons)
        if (p.photo_url) m.set(`share/${p.id}`, p.photo_url);
    return m;
  }, [data]);

  // (Re-)initialise the chart on orientation change. Focal updates do
  // NOT re-init — we call chart.updateMainId() instead so the camera
  // smoothly pans/zooms to the new centre.
  useEffect(() => {
    if (!containerRef.current || !f3Data) return;
    let disposed = false;
    const node = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let linkObserver: MutationObserver | null = null;
    let linkRaf = 0;

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

            // Dâu/rể (không có cha/mẹ trong họ & không phải thuỷ tổ) → viền đứt.
            const parents = (
              datum as unknown as { rels?: { parents?: unknown[] } } | undefined
            )?.rels?.parents;
            if (fields["is_root"] !== true && (!parents || parents.length === 0)) {
              const rect = this.querySelector(".card-body rect");
              if (rect) {
                rect.setAttribute("stroke", "#B8862A");
                rect.setAttribute("stroke-dasharray", "4 3");
                rect.setAttribute("stroke-width", "1.5");
              }
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

        // "3 đời" tính cả người làm tâm = depth - 1 tầng mỗi phía.
        const d = depth === 0 ? 999 : depth - 1;
        built.setProgenyDepth?.(d);
        built.setAncestryDepth?.(d);

        if (focal && built.updateMainId) built.updateMainId(focal);

        // Wait one paint frame so the browser has actually laid the
        // container out — otherwise treeFit anchors at the top-left
        // and cards stay tiny on first render.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        if (disposed) return;

        // Tô màu đường nối theo giới người con (con trai xanh / con gái hồng),
        // hôn nhân đỏ — đồng bộ với cây 3D. Gắn observer TRƯỚC updateTree.
        const colorLinks = () => {
          const dark = document.documentElement.classList.contains("dark");
          const MALE = dark ? "#6FA0C8" : "#5B8FB8";
          const FEMALE = dark ? "#D08A91" : "#C97F86";
          const MARRIAGE = dark ? "#D24545" : "#9B3535";
          node
            .querySelectorAll<SVGPathElement>(".links_view .link")
            .forEach((p) => {
              const d = (
                p as unknown as {
                  __data__?: { spouse?: boolean; source?: unknown; target?: unknown };
                }
              ).__data__;
              if (!d) return;
              let color = MARRIAGE;
              if (!d.spouse) {
                const child = Array.isArray(d.source) ? d.target : d.source;
                const gender = (
                  child as { data?: { data?: { gender?: string } } } | undefined
                )?.data?.data?.gender;
                color = gender === "F" ? FEMALE : MALE;
              }
              p.style.stroke = color;
            });
        };
        const linksView0 = node.querySelector(".links_view");
        if (linksView0) {
          linkObserver = new MutationObserver(() => {
            if (linkRaf) cancelAnimationFrame(linkRaf);
            linkRaf = requestAnimationFrame(colorLinks);
          });
          linkObserver.observe(linksView0, { childList: true });
        }

        built.updateTree({ initial: true });
        chartRef.current = built;
        colorLinks();
        requestAnimationFrame(colorLinks);
        requestAnimationFrame(() => requestAnimationFrame(colorLinks));

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
      linkObserver?.disconnect();
      if (linkRaf) cancelAnimationFrame(linkRaf);
      node.innerHTML = "";
    };
  }, [f3Data, orientation, data?.generation_offset, depth, isFullscreen, treeMode]);

  // Toàn màn hình → portal khối cây ra <body> để phủ kín, không kẹt
  // trong stacking context của trang.
  const renderTreeWrap = (node: React.ReactNode) =>
    isFullscreen ? createPortal(node, document.body) : node;

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

  // QR tại mộ — scope='resting_place' renders the grave card.
  if (data && data.scope === "resting_place" && data.resting_place) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b py-3 px-4 shrink-0">
          <h1 className="clan-name text-xl font-semibold text-center">
            Mộ phần / tro cốt
          </h1>
          <p className="text-xs text-center text-muted-foreground mt-1">
            Đang xem qua liên kết chia sẻ.
          </p>
        </header>
        <main className="flex-1 min-h-0">
          <SharedRestingPlaceCard rp={data.resting_place} />
        </main>
      </div>
    );
  }

  // QR di sản — scope='heritage_item' renders the heritage card.
  if (data && data.scope === "heritage_item" && data.heritage_item) {
    const h = data.heritage_item;
    const dir =
      h.latitude != null && h.longitude != null
        ? `https://www.google.com/maps?q=${h.latitude},${h.longitude}`
        : null;
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b py-3 px-4 shrink-0">
          <h1 className="clan-name text-xl font-semibold text-center">Di sản & Văn hoá</h1>
          <p className="text-xs text-center text-muted-foreground mt-1">
            Đang xem qua liên kết chia sẻ.
          </p>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-2xl p-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{HERITAGE_CATEGORY_LABEL[h.category]}</p>
              <h2 className="text-2xl font-semibold">{h.title}</h2>
              {h.summary && <p className="text-base mt-1">{h.summary}</p>}
            </div>

            {h.photo_urls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {h.photo_urls.map((u, i) => (
                  <img key={i} src={u} alt="" className="aspect-square w-full rounded-md object-cover bg-muted" />
                ))}
              </div>
            )}

            {h.videos.length > 0 && (
              <div className="space-y-2">
                {h.videos.map((v, i) => {
                  const embed = videoEmbedUrl(v.url);
                  return embed ? (
                    <iframe
                      key={i}
                      src={embed}
                      title="Video di sản"
                      className="aspect-video w-full rounded-md border"
                      allow="encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <video key={i} controls preload="none" src={v.url} className="w-full rounded-md border" />
                  );
                })}
              </div>
            )}

            {h.audios.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Ghi âm kể chuyện</p>
                {h.audios.map((a, i) => (
                  <audio key={i} controls preload="none" src={a.url} className="w-full" />
                ))}
              </div>
            )}

            {h.body && (
              <p className="whitespace-pre-wrap text-base leading-relaxed">{h.body}</p>
            )}

            {(h.location_name || h.address || h.built_year || dir) && (
              <div className="rounded-md border p-3 text-base space-y-1">
                {h.location_name && <p><span className="text-muted-foreground">Ở đâu: </span>{h.location_name}</p>}
                {h.address && <p><span className="text-muted-foreground">Địa chỉ: </span>{h.address}</p>}
                {h.built_year && <p><span className="text-muted-foreground">Lập / xây năm: </span>{h.built_year}</p>}
                {dir && (
                  <a href={dir} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-block mt-1">
                    Chỉ đường →
                  </a>
                )}
              </div>
            )}

            {h.people.length > 0 && (
              <div>
                <p className="font-medium mb-1">Người liên quan</p>
                <ul className="text-base space-y-0.5">
                  {h.people.map((p, i) => (
                    <li key={i}>
                      {p.full_name}
                      {p.role_note ? <span className="text-muted-foreground"> — {p.role_note}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

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
          {publicClan
            ? "Bản xem công khai — thông tin nhạy cảm của người còn sống (ngày tháng, nơi chốn) đã được ẩn."
            : "Đang xem qua liên kết chia sẻ — thông tin nhạy cảm của người còn sống (ngày tháng, nơi chốn) đã được ẩn."}
        </p>
        {publicClan && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 print-hide">
            <Button asChild size="sm">
              <Link
                to={`/login?next=${encodeURIComponent(`/clans/${clanId}`)}`}
              >
                Đăng nhập để xem đầy đủ &amp; cùng vun đắp
              </Link>
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        {isLoading && (
          <p className="p-8 text-center text-muted-foreground">Đang tải…</p>
        )}
        {error && (
          <div className="p-4 max-w-md mx-auto w-full space-y-3">
            <Alert variant="destructive">
              <AlertDescription>
                {(error as Error).message}
              </AlertDescription>
            </Alert>
            {publicClan && (
              <Button asChild className="w-full">
                <Link
                  to={`/login?next=${encodeURIComponent(`/clans/${clanId}`)}`}
                >
                  Đăng nhập để xem dòng họ này
                </Link>
              </Button>
            )}
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
              {/* 2D ↔ 3D — luôn hiển thị. */}
              <SegmentedControl ariaLabel="Chế độ cây">
                <SegmentedButton
                  active={treeMode === "2d"}
                  onClick={() => setTreeMode("2d")}
                  ariaLabel="Xem cây 2D"
                  className="px-3"
                >
                  2D
                </SegmentedButton>
                <SegmentedButton
                  active={treeMode === "3d"}
                  onClick={() => setTreeMode("3d")}
                  ariaLabel="Xem cây 3D"
                  className="px-3"
                >
                  3D
                </SegmentedButton>
              </SegmentedControl>
              {/* Hướng cây + số đời chỉ áp cho cây 2D. */}
              {treeMode === "2d" && (
                <>
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
                  {/* Số đời hiển thị quanh người làm tâm — mặc định 3 cho
                      nhẹ máy; bấm vào thẻ để xem nhánh sâu hơn. w-full →
                      xuống dòng riêng trên mobile. */}
                  <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      Số đời hiển thị:
                    </span>
                    <SegmentedControl ariaLabel="Số đời hiển thị quanh người làm tâm">
                      {DEPTH_OPTIONS.map((d) => (
                        <SegmentedButton
                          key={d}
                          active={depth === d}
                          onClick={() => setDepth(d)}
                          title={
                            d === 0
                              ? "Hiện tất cả các đời"
                              : `Hiện ${d} đời tính từ người làm tâm`
                          }
                          className="px-2 sm:px-3"
                        >
                          {d === 0 ? "Tất cả" : d}
                        </SegmentedButton>
                      ))}
                    </SegmentedControl>
                  </div>
                </>
              )}
            </div>

            {treeMode === "3d" && tree3dData ? (
              <div className="relative flex-1 min-h-0 w-full">
                <Suspense
                  fallback={
                    <p className="p-8 text-center text-muted-foreground">
                      Đang dựng cây 3D…
                    </p>
                  }
                >
                  <Tree3DView
                    clanId={data.clan_id}
                    genOffset={data.generation_offset ?? 0}
                    focal={focal}
                    data={tree3dData}
                    photoUrls={tree3dPhotos}
                    className="h-full w-full"
                  />
                </Suspense>
              </div>
            ) : (
              renderTreeWrap(
                <div
                  ref={shareWrapRef}
                  className={
                    isFullscreen
                      ? "fixed inset-0 z-[60] bg-background p-2"
                      : "relative flex-1 min-h-0 w-full"
                  }
                >
                  <div
                    ref={containerRef}
                    className="f3 h-full w-full text-foreground"
                    style={
                      {
                        "--male-color": "var(--tree-card-male)",
                        "--female-color": "var(--tree-card-female)",
                      } as React.CSSProperties
                    }
                    aria-label="Cây gia phả tương tác (chỉ xem)"
                  />
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="absolute bottom-2 right-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 border shadow-sm text-foreground hover:bg-card hover:border-primary backdrop-blur-sm"
                    aria-label={isFullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
                    title={isFullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
                  >
                    {isFullscreen ? (
                      <IconMinimize className="h-4 w-4" />
                    ) : (
                      <IconMaximize className="h-4 w-4" />
                    )}
                  </button>
                </div>,
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}
