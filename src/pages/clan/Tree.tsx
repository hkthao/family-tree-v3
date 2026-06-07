import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  IconLayoutHorizontal,
  IconLayoutVertical,
  IconPlus,
  IconPrinter,
  IconUpload,
} from "@/components/icons";
import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  addInlawGhosts,
  pickDefaultFocal,
  toFamilyChart,
} from "@/lib/familyChartAdapter";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { queryKeys } from "@/lib/queries/keys";
import {
  getInlawGhostSpouses,
  listLinksForClan,
  listLinksForPerson,
} from "@/lib/queries/person-links";
import { InlawFamilyCard } from "@/components/InlawFamilyCard";
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
  updateMainId?: (id: string) => void;
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

type Orientation = "vertical" | "horizontal";
const ORIENTATION_KEY = "family-tree:tree-orientation";

function readOrientation(): Orientation {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === "horizontal"
      ? "horizontal"
      : "vertical";
  } catch {
    return "vertical";
  }
}

export default function Tree() {
  const { clan } = useClanContext();
  const navigate = useNavigate();
  const canEdit = canEditClan(clan);
  const clanId = clan.id;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3Chart | null>(null);
  const [focal, setFocal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orientation, setOrientation] = useState<Orientation>(() =>
    readOrientation(),
  );

  // Persist the chosen orientation so the user gets the same layout
  // next time they open the tree.
  useEffect(() => {
    try {
      localStorage.setItem(ORIENTATION_KEY, orientation);
    } catch {
      /* private mode — ignore */
    }
  }, [orientation]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });

  // Batch-resolve signed URLs for every uploaded photo on the tree.
  const treePhotoPaths = useMemo(
    () =>
      [
        ...new Set(
          (data?.persons ?? [])
            .map((p) => p.photo_path)
            .filter((p): p is string => !!p),
        ),
      ].sort(),
    [data],
  );
  const { data: photoUrls } = useQuery({
    queryKey: ["signed-photos-batch", clan.id, "tree", treePhotoPaths],
    queryFn: () => getSignedPhotoUrlMap(treePhotoPaths),
    enabled: treePhotoPaths.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Ghost spouses: peer-clan spouses of locally-mirrored inlaws,
  // synthesised onto the local tree as dashed-border placeholder
  // cards. Loaded in parallel with the main tree data — when missing,
  // the tree still renders without ghosts so a slow Edge call never
  // blocks the main view.
  const { data: ghostSpouses } = useQuery({
    queryKey: queryKeys.inlawGhostSpouses(clan.id, userId),
    queryFn: () => getInlawGhostSpouses(clan.id),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const f3Data = useMemo(() => {
    if (!data) return null;
    const base = toFamilyChart(data.persons, data.families, photoUrls);
    if (ghostSpouses && ghostSpouses.length > 0) {
      addInlawGhosts(base, ghostSpouses);
    }
    return base;
  }, [data, photoUrls, ghostSpouses]);

  // Persons with an active cross-clan in-law link — used to decorate
  // their card with a "↔" badge. We only need the set of ids; the
  // peek itself is fetched on badge click.
  const { data: clanLinks } = useQuery({
    queryKey: queryKeys.personLinksForClan(clan.id, userId),
    queryFn: () => listLinksForClan(clan.id),
    enabled: !!userId,
  });
  const linkedPersonIds = useMemo(() => {
    const set = new Set<string>();
    for (const l of clanLinks ?? []) {
      if (l.status !== "confirmed") continue;
      // Either side could be in this clan; only the local-clan id is
      // useful for matching cards we'll render.
      if (l.clan_a_id === clan.id && l.person_a_id) set.add(l.person_a_id);
      if (l.clan_b_id === clan.id && l.person_b_id) set.add(l.person_b_id);
    }
    return set;
  }, [clanLinks, clan.id]);

  // Badge dialog state. The card-update closure runs inside
  // family-chart's d3 render — refs let it read the latest values
  // without rebuilding the whole chart whenever a new link confirms.
  const [badgePersonId, setBadgePersonId] = useState<string | null>(null);
  const setBadgePersonRef = useRef(setBadgePersonId);
  useEffect(() => {
    setBadgePersonRef.current = setBadgePersonId;
  }, [setBadgePersonId]);
  const linkedIdsRef = useRef<Set<string>>(linkedPersonIds);
  useEffect(() => {
    linkedIdsRef.current = linkedPersonIds;
  }, [linkedPersonIds]);

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
            const datum = d.data as DatumNode | undefined;
            const fields = datum?.data ?? {};
            const personId = datum?.id;
            const isGhost = fields["is_ghost"] === true;

            const tspans = this.querySelectorAll<SVGTSpanElement>(
              ".card-text text tspan",
            );
            const meta = tspans[1];
            if (meta) {
              meta.setAttribute("text-anchor", "start");
              meta.setAttribute("x", "0");
              meta.setAttribute("dy", "18");
            }

            // Ghost-spouse styling: dashed bronze border + "Họ X" tag
            // along the top edge. Re-apply on every update because
            // family-chart owns the inner DOM and may rebuild it.
            if (isGhost) {
              const rect = this.querySelector(".card-body rect");
              if (rect) {
                rect.setAttribute("stroke", "#B8862A");
                rect.setAttribute("stroke-dasharray", "4 3");
                rect.setAttribute("stroke-width", "1.5");
                rect.setAttribute("fill", "#FBF7F0");
              }
              this.querySelector(".ghost-clan-tag")?.remove();
              const clanName =
                (fields["ghost_peer_clan_name"] as string | undefined) ?? "";
              if (clanName) {
                const ns = "http://www.w3.org/2000/svg";
                const tag = document.createElementNS(ns, "g");
                tag.setAttribute("class", "ghost-clan-tag");
                const tagW = 10 + clanName.length * 6;
                const bg = document.createElementNS(ns, "rect");
                bg.setAttribute("x", "64");
                bg.setAttribute("y", "-9");
                bg.setAttribute("rx", "4");
                bg.setAttribute("ry", "4");
                bg.setAttribute("height", "14");
                bg.setAttribute("width", String(tagW));
                bg.setAttribute("fill", "#B8862A");
                const txt = document.createElementNS(ns, "text");
                txt.setAttribute("x", String(64 + tagW / 2));
                txt.setAttribute("y", "0");
                txt.setAttribute("text-anchor", "middle");
                txt.setAttribute("fill", "#FFFFFF");
                txt.setAttribute("font-size", "9");
                txt.setAttribute("font-weight", "600");
                txt.textContent = clanName;
                tag.appendChild(bg);
                tag.appendChild(txt);
                this.querySelector(".card-body")?.appendChild(tag);
              }
              // Clickable transparent overlay → open the badge dialog
              // for the LOCAL anchor person (dialog already shows
              // peer family card). Remove the old overlay first to
              // avoid handler accumulation across re-renders.
              const localId = fields["ghost_local_person_id"] as
                | string
                | undefined;
              this.querySelector(".ghost-click-overlay")?.remove();
              if (localId) {
                const ns = "http://www.w3.org/2000/svg";
                const overlay = document.createElementNS(ns, "rect");
                overlay.setAttribute("class", "ghost-click-overlay");
                overlay.setAttribute("x", "0");
                overlay.setAttribute("y", "0");
                overlay.setAttribute("width", "260");
                overlay.setAttribute("height", "72");
                overlay.setAttribute("fill", "transparent");
                overlay.style.cursor = "pointer";
                overlay.addEventListener("click", (e) => {
                  e.stopPropagation();
                  setBadgePersonRef.current(localId);
                });
                this.querySelector(".card-body")?.appendChild(overlay);
              }
              // Skip the gen badge / inlaw badge / edit actions for
              // ghosts — they're stubs, not real persons in this clan.
              return;
            }

            // Generation badge — small pill in the top-right corner.
            const gen = fields["generation"];
            if (typeof gen === "number" && gen > 0) {
              this.querySelector(".gen-badge")?.remove();
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

            // In-law link badge — small "↔" pill on the same top row
            // as the generation badge (left of it). Solid bronze fill
            // + white glyph so it stays legible on both light and dark
            // card backgrounds. Previously sat on the right edge at
            // mid-height where it collided with the hover action
            // buttons (add / edit) at y=46.
            this.querySelector(".inlaw-badge")?.remove();
            if (personId && linkedIdsRef.current.has(personId)) {
              const inlaw = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "g",
              );
              inlaw.setAttribute("class", "inlaw-badge");
              inlaw.innerHTML = `
                <circle cx="200" cy="15" r="9" fill="#B8862A"
                        stroke="#FBF7F0" stroke-width="1" />
                <text x="200" y="19" text-anchor="middle"
                      fill="#FFFFFF" font-size="12" font-weight="700">↔</text>
                <title>Liên kết thông gia — bấm để xem</title>`;
              inlaw.style.cursor = "pointer";
              inlaw.addEventListener("click", (e) => {
                e.stopPropagation();
                setBadgePersonRef.current(personId);
              });
              this.querySelector(".card-body")?.appendChild(inlaw);
            }

            // Quick actions: pencil = edit, plus = open detail (where
            // add-spouse / add-child / etc. live). Visible only when the
            // viewer can edit (admin/editor incl. platform admin); hidden
            // until the card is hovered (CSS in index.css). Routes
            // reuse our existing /people/:id/edit + detail pages so the
            // f3 library doesn't need its built-in editTree UI.
            this.querySelector(".card-actions")?.remove();
            if (canEdit && personId) {
              const actions = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "g",
              );
              actions.setAttribute("class", "card-actions");
              actions.innerHTML = `
                <g class="card-action card-action-add"
                   transform="translate(208, 46)">
                  <circle cx="11" cy="11" r="11" fill="#FBF7F0"
                          stroke="#7A2E2E" stroke-width="1.5" />
                  <path d="M11 6 V16 M6 11 H16" stroke="#7A2E2E"
                        stroke-width="2" stroke-linecap="round"
                        fill="none" />
                </g>
                <g class="card-action card-action-edit"
                   transform="translate(234, 46)">
                  <circle cx="11" cy="11" r="11" fill="#FBF7F0"
                          stroke="#7A2E2E" stroke-width="1.5" />
                  <path d="M7 15 L7 13 L13 7 L15 9 L9 15 Z"
                        fill="#7A2E2E" />
                </g>
              `;

              // Carry `?from=tree` so PersonDetail / EditPerson know
              // to render the breadcrumb as "← Cây gia phả" and to
              // navigate back to /tree on cancel/save.
              const fromQs = "?from=tree";
              const editEl = actions.querySelector(".card-action-edit");
              editEl?.addEventListener("click", (e) => {
                e.stopPropagation();
                navigate(
                  `/clans/${clanId}/people/${personId}/edit${fromQs}`,
                );
              });

              const addEl = actions.querySelector(".card-action-add");
              addEl?.addEventListener("click", (e) => {
                e.stopPropagation();
                navigate(`/clans/${clanId}/people/${personId}${fromQs}`);
              });

              this.querySelector(".card-body")?.appendChild(actions);
            }
          });

        // Spacing tuned per orientation. family-chart swaps the X/Y
        // pair internally when horizontal, so the centre-to-centre
        // gap each axis enforces *on screen* stays consistent:
        //   X = horizontal screen distance,
        //   Y = vertical screen distance.
        // Our cards are 260×72, so X needs ≥ ~290 to avoid horizontal
        // overlap in either mode, and Y ≥ ~100 to clear the card
        // height. Vertical mode allows tighter Y because siblings
        // stack horizontally instead.
        built.setTransitionTime(200);
        if (orientation === "horizontal") {
          built.setOrientationHorizontal?.();
          // Generations flow left→right → X must clear card width.
          // Siblings stack top→bottom → Y must clear card height.
          built.setCardXSpacing(320).setCardYSpacing(100);
        } else {
          built.setOrientationVertical?.();
          // Siblings stack left→right → X must clear card width.
          // Generations flow top→bottom → Y must clear card height.
          built.setCardXSpacing(290).setCardYSpacing(160);
        }

        // Anchor the chart on the chosen focal (Thuỷ tổ by default).
        // Without this, family-chart picks an arbitrary first row as
        // "main" and Đời 1 ends up collapsed off-screen.
        if (focal && built.updateMainId) built.updateMainId(focal);

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
        chartRef.current = built;

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
      chartRef.current = null;
      node.innerHTML = "";
    };
  }, [f3Data, focal, orientation]);

  // Before the OS print dialog opens (either via our "In" button or
  // OS-level Cmd/Ctrl+P), refit the tree to the printable area.
  // family-chart measures the container via getBoundingClientRect,
  // but `beforeprint` fires while the on-screen layout is still
  // active — the chart would otherwise fit to viewport, not page.
  //
  // The trick: temporarily force the container's inline size to
  // match A3 landscape minus margins + title (40×27 cm rendered as
  // CSS pixels — 96 dpi → 1512×1020). updateTree({initial:true})
  // then fits everything into that target box. The print engine
  // snapshots the resized SVG; the print stylesheet (.f3 width/
  // height in cm) just clips to the same area.
  //
  // afterprint restores the original screen layout.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 96 dpi assumption — Chrome/Firefox use 96 css px per inch
    // for printable layout regardless of the physical printer.
    const PRINT_PX = { w: Math.round((40 / 2.54) * 96), h: Math.round((27 / 2.54) * 96) };

    let savedWidth = "";
    let savedHeight = "";

    const onBeforePrint = () => {
      const c = chartRef.current;
      const node = containerRef.current;
      if (!c || !node) return;
      savedWidth = node.style.width;
      savedHeight = node.style.height;
      node.style.width = `${PRINT_PX.w}px`;
      node.style.height = `${PRINT_PX.h}px`;
      c.setTransitionTime(0);
      c.updateTree({ initial: true });
    };

    const onAfterPrint = () => {
      const c = chartRef.current;
      const node = containerRef.current;
      if (!c || !node) return;
      node.style.width = savedWidth;
      node.style.height = savedHeight;
      c.setTransitionTime(200);
      c.updateTree({ initial: false });
    };

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

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
      {/* Print-only title strip — shows "Họ Nguyễn — Cây gia phả · 2026-06-01"
          at the top of the printed page. The on-screen flow ignores it. */}
      <div className="print-only" aria-hidden="true">
        <h1 style={{ fontSize: "18pt", fontWeight: 600, marginBottom: "0.4cm" }}>
          {clan.name} — Cây gia phả
        </h1>
        <p style={{ fontSize: "10pt", color: "#555", marginBottom: "0.6cm" }}>
          In ngày {new Date().toLocaleDateString("vi-VN")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 print-hide">
        <h2 className="text-2xl font-semibold sm:flex-1">Cây gia phả</h2>
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => window.print()}
            title="In trang này (Ctrl/Cmd+P)"
          >
            <IconPrinter className="h-4 w-4 mr-1.5" />
            In
          </Button>
          {/* Orientation toggle — vertical (top-down) vs horizontal
              (left-right). Re-inits the chart via the orientation dep
              on the init effect so the layout flips immediately. */}
          <SegmentedControl ariaLabel="Hướng cây">
            <SegmentedButton
              active={orientation === "vertical"}
              onClick={() => setOrientation("vertical")}
              title="Dọc — gốc ở trên, đời con xuống dưới"
              className="inline-flex items-center gap-1.5 px-3"
            >
              <IconLayoutVertical className="h-4 w-4" />
              Dọc
            </SegmentedButton>
            <SegmentedButton
              active={orientation === "horizontal"}
              onClick={() => setOrientation("horizontal")}
              title="Ngang — gốc ở trái, đời con sang phải"
              className="inline-flex items-center gap-1.5 px-3"
            >
              <IconLayoutHorizontal className="h-4 w-4" />
              Ngang
            </SegmentedButton>
          </SegmentedControl>
          <RefreshButton
            clanId={clan.id}
            cachedVersion={clan.data_version}
            compact
          />
        </div>
      </div>

      {isLoading && (
        <p className="text-muted-foreground">Đang tải cây…</p>
      )}

      {!isLoading && data && data.persons.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chưa có dữ liệu</CardTitle>
            <CardDescription>
              {canEdit
                ? "Bắt đầu bằng cách thêm Thuỷ tổ (đời 1), hoặc nhập sẵn từ Excel."
                : "Quản trị/biên tập viên sẽ thêm thành viên trước."}
            </CardDescription>
          </CardHeader>
          {canEdit && (
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/clans/${clanId}/people/new`}>
                  <IconPlus className="h-4 w-4 mr-1.5" />
                  Thêm người
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/clans/${clanId}/import`}>
                  <IconUpload className="h-4 w-4 mr-1.5" />
                  Nhập từ Excel
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {data && data.persons.length > 0 && (
        <>
          <div className="space-y-2 print-hide">
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
            className="f3 rounded-lg border bg-card overflow-hidden h-[70vh] min-h-[480px] max-h-[820px] text-foreground"
            style={
              {
                "--male-color": "var(--tree-card-male)",
                "--female-color": "var(--tree-card-female)",
                "--genderless-color": "var(--tree-card-genderless)",
              } as React.CSSProperties
            }
            aria-label="Cây gia phả tương tác"
          />
          <p className="text-xs text-muted-foreground print-hide">
            Vuốt để di chuyển, kéo 2 ngón để phóng to/thu nhỏ. Chạm vào thẻ
            người để mở rộng nhánh.
          </p>
        </>
      )}

      <InlawBadgeDialog
        personId={badgePersonId}
        userId={userId}
        onClose={() => setBadgePersonId(null)}
      />
    </div>
  );
}

// ─── In-law badge popup ──────────────────────────────────────────────

/**
 * Lightweight modal that pops up from the tree when the user taps a
 * "↔" badge. Lists every confirmed link the focal person is part of,
 * showing the peer projection via get_link_peek — same data path
 * PersonDetail uses, so visibility/masking is consistent.
 */
function InlawBadgeDialog({
  personId,
  userId,
  onClose,
}: {
  personId: string | null;
  userId: string;
  onClose: () => void;
}) {
  const open = !!personId;

  // ESC + body-scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border bg-card shadow-lg overflow-hidden"
      >
        <header className="border-b px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <span aria-hidden="true">↔</span>
            Liên kết thông gia
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
          >
            ✕
          </button>
        </header>
        <div className="p-5">
          <InlawBadgeBody personId={personId!} userId={userId} />
        </div>
      </div>
    </div>
  );
}

function InlawBadgeBody({
  personId,
  userId,
}: {
  personId: string;
  userId: string;
}) {
  // Reuse PersonDetail's typed helper + the canonical "person-links"
  // cache prefix so mutations (revoke / accept / propose) invalidate
  // this query too. The earlier one-off ["tree-inlaw-dialog", personId]
  // key sat outside the inlaws invalidation set and went stale after
  // every state change.
  const { data: links, isLoading } = useQuery({
    queryKey: queryKeys.personLinksForPerson(personId, userId),
    queryFn: () => listLinksForPerson(personId),
    enabled: !!userId,
  });
  if (isLoading)
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  if (!links || links.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Không còn liên kết nào.</p>
    );
  return (
    <div className="space-y-5">
      {links.map((l, idx) => (
        <div key={l.id}>
          {idx > 0 && <hr className="my-5 border-t" />}
          <InlawFamilyCard linkId={l.id} />
        </div>
      ))}
    </div>
  );
}
