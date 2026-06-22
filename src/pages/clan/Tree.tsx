import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  IconDownload,
  IconHome,
  IconLayoutHorizontal,
  IconLayoutVertical,
  IconPlus,
  IconTree,
  IconUpload,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { RefreshButton } from "@/components/RefreshButton";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toast";
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
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
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
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { RelationSheet } from "@/components/RelationSheet";
import { ShareTreeButton } from "@/components/ShareTreeButton";
import { EditPersonForm } from "@/pages/clan/EditPerson";
import { track } from "@/lib/analytics";
import { matchesName } from "@/lib/unaccent";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { getTreeData } from "@/lib/queries/tree";

import "family-chart/styles/family-chart.css";

interface F3Chart {
  setCardYSpacing: (n: number) => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setOrientationHorizontal?: () => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setTransitionTime: (n: number) => F3Chart;
  setSingleParentEmptyCard: (
    b: boolean,
    opts?: { label?: string },
  ) => F3Chart;
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
  const canEdit = canEditClan(clan);
  const clanId = clan.id;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3Chart | null>(null);
  const [focal, setFocal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Touch-mode gate: on phones, the chart starts "locked" so the
  // user can scroll the page past it with one finger; tapping the
  // overlay unlocks pan/zoom. Desktops (hover-capable pointers) keep
  // the chart unlocked since there's no scroll-conflict with a mouse.
  const [chartActive, setChartActive] = useState(true);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none)").matches
    ) {
      setChartActive(false);
    }
  }, []);
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

  // Tuỳ chọn hiển thị thêm trên thẻ — nay là cài đặt cấp dòng họ (quản
  // trị bật/tắt ở Cài đặt dòng họ), áp đồng nhất cho mọi người xem cây.
  const showDeceasedDetails = clan.display_death_details;
  const showLivingDob = clan.display_living_full_dob;

  // Non-members of a public clan need the masked views — same pattern
  // as /people. Without this the tree shows "no data" on public clans
  // for visitors who aren't joined yet.
  const treeSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
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

  // Zoom helpers wired to the family-chart d3.zoom instance. The
  // library stashes its zoom object on `__zoomObj` of the listener
  // element (the main SVG); we use scaleBy via dynamic-import d3 to
  // avoid pulling d3 into the initial bundle.
  async function zoomBy(factor: number) {
    const root = containerRef.current;
    if (!root) return;
    const svg = root.querySelector("svg.main_svg") as SVGSVGElement | null;
    if (!svg) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomObj = (svg as any).__zoomObj || (svg.parentElement as any | null)?.__zoomObj;
    if (!zoomObj) return;
    const { select } = await import("d3-selection");
    await import("d3-transition");
    select(svg as Element)
      .transition()
      .duration(200)
      .call(zoomObj.scaleBy, factor);
  }

  // Pencil-icon edit opens an inline sheet instead of navigating away
  // — the d3 card closure reads `setEditPersonRef.current` so it can
  // call the latest setter without forcing a chart rebuild.
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const setEditPersonRef = useRef(setEditPersonId);
  useEffect(() => {
    setEditPersonRef.current = setEditPersonId;
  }, [setEditPersonId]);

  // "+" button opens the quick-add sheet (relation picker + mini-form
  // for con/vợ-chồng/cha-mẹ). Same ref-bridge pattern as edit above so
  // the d3 closure doesn't pin a stale setter.
  const [quickAddPersonId, setQuickAddPersonId] = useState<string | null>(null);
  const setQuickAddRef = useRef(setQuickAddPersonId);
  useEffect(() => {
    setQuickAddRef.current = setQuickAddPersonId;
  }, [setQuickAddPersonId]);
  const linkedIdsRef = useRef<Set<string>>(linkedPersonIds);
  useEffect(() => {
    linkedIdsRef.current = linkedPersonIds;
  }, [linkedPersonIds]);

  // Compute the default focal (Thuỷ tổ, or oldest if none flagged).
  // Cached so the "Về mặc định" button can compare cheaply and the
  // initialisation effect below doesn't recompute on every render.
  const defaultFocal = useMemo(
    () => (data ? pickDefaultFocal(data.persons) : null),
    [data],
  );
  useEffect(() => {
    if (defaultFocal && focal === null) {
      setFocal(defaultFocal);
    }
  }, [defaultFocal, focal]);

  // Human-readable name of the current focal — used in the "Về mặc
  // định" hint so the user knows what they're switching away from.
  const focalName = useMemo(() => {
    if (!data || !focal) return null;
    return data.persons.find((p) => p.id === focal)?.full_name ?? null;
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

        // Vietnamese gia phả routinely don't record wives — the lib's
        // default "?" placeholder makes the tree look broken on those
        // families. Turn it off entirely: single-parent families draw
        // children straight under the recorded parent (no phantom
        // partner), and multi-parent families still show both cards
        // normally — the lib supports both shapes on the same tree.
        built.setSingleParentEmptyCard(false);

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
        // Line 2: năm sinh–mất. Với người sống, nếu user bật tuỳ chọn
        // thì hiện ngày-tháng-năm sinh đầy đủ thay vì chỉ năm.
        const dateLine = (d: DatumNode): string => {
          const f = d.data ?? {};
          const isLiving = f["is_living"] !== false;
          if (isLiving && showLivingDob) {
            const full = (f["birth_full"] as string) || "";
            if (full) return `Sinh ${full}`;
          }
          const b = (f["birthday"] as string) || "?";
          const death = (f["death_year"] as string) || (isLiving ? "" : "?");
          return death ? `${b} - ${death}` : b;
        };
        // Line 3 (chỉ khi bật tuỳ chọn): ngày giỗ + tuổi thọ cho người
        // đã mất. Người sống → dòng trống.
        const deceasedExtra = (d: DatumNode): string => {
          const f = d.data ?? {};
          if (f["is_living"] !== false) return "";
          const parts: string[] = [];
          // Đã gồm sẵn "Thọ …" / "Hưởng dương …" theo phong tục.
          const tho = (f["lifespan_text"] as string) || "";
          if (tho) parts.push(tho);
          const anniv = (f["death_anniv"] as string) || "";
          if (anniv) parts.push(`Giỗ ${anniv}`);
          return parts.join(" · ");
        };

        const displayLines: CardDisplayFn[] = [
          (d) => String((d as DatumNode).data?.["full name"] ?? ""),
          (d) => dateLine(d as DatumNode),
        ];
        if (showDeceasedDetails) {
          displayLines.push((d) => deceasedExtra(d as DatumNode));
        }

        card
          ?.setCardDisplay(
            displayLines as unknown as Parameters<F3Card["setCardDisplay"]>[0],
          )
          // Card 220×64: vừa đủ tên Việt 3-4 từ + lifespan, tiết kiệm
          // ~15% diện tích vẽ. 50px circular avatar inset 8px, text bắt
          // đầu ở x=64 (avatar + 6px gap) → 156px còn lại cho name +
          // meta line. Avatar img_y=7 để center theo trục y với h=64.
          // Khi bật chi tiết người mất, nới rộng để chứa dòng giỗ/thọ.
          .setCardDim({
            // Nới nhẹ khi hiện giỗ/thọ; dòng đó dùng cỡ chữ nhỏ hơn (10)
            // nên không cần rộng nhiều mà vẫn đủ chỗ cho "… Giỗ D/M ÂL".
            w: showDeceasedDetails ? 268 : showLivingDob ? 240 : 220,
            h: showDeceasedDetails ? 74 : 64,
            text_x: 64,
            text_y: 18,
            img_w: 50,
            img_h: 50,
            img_x: 8,
            img_y: showDeceasedDetails ? 12 : 7,
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
            // Dòng 3 (giỗ + tuổi thọ) — đặt dưới dòng năm, chữ nhỏ + mờ.
            const extra = tspans[2];
            if (extra) {
              extra.setAttribute("text-anchor", "start");
              extra.setAttribute("x", "0");
              extra.setAttribute("dy", "16");
              extra.setAttribute("font-size", "10");
              extra.setAttribute("fill", "#8A7A66");
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
                overlay.setAttribute("width", "220");
                overlay.setAttribute("height", "64");
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
            // DB lưu generation thực (1-based); trừ clan.generation_offset
            // khi render để tôn trọng cài đặt "Thủy tổ là Đời 0".
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
                  Đời ${gen - clan.generation_offset}
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
                <circle cx="160" cy="15" r="9" fill="#B8862A"
                        stroke="#FBF7F0" stroke-width="1" />
                <text x="160" y="19" text-anchor="middle"
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
                   transform="translate(168, 38)">
                  <circle cx="11" cy="11" r="11" fill="#FBF7F0"
                          stroke="#7A2E2E" stroke-width="1.5" />
                  <path d="M11 6 V16 M6 11 H16" stroke="#7A2E2E"
                        stroke-width="2" stroke-linecap="round"
                        fill="none" />
                </g>
                <g class="card-action card-action-edit"
                   transform="translate(194, 38)">
                  <circle cx="11" cy="11" r="11" fill="#FBF7F0"
                          stroke="#7A2E2E" stroke-width="1.5" />
                  <path d="M7 15 L7 13 L13 7 L15 9 L9 15 Z"
                        fill="#7A2E2E" />
                </g>
              `;

              // Carry `?from=tree` so PersonDetail / EditPerson know
              // to render the breadcrumb as "← Cây gia phả" and to
              // navigate back to /tree on cancel/save. Edit still opens
              // the full sheet; "+" opens the lightweight quick-add
              // sheet (relation picker + name-only mini-form).
              const editEl = actions.querySelector(".card-action-edit");
              editEl?.addEventListener("click", (e) => {
                e.stopPropagation();
                setEditPersonRef.current(personId);
              });

              const addEl = actions.querySelector(".card-action-add");
              addEl?.addEventListener("click", (e) => {
                e.stopPropagation();
                setQuickAddRef.current(personId);
              });

              this.querySelector(".card-body")?.appendChild(actions);
            }
          });

        // Spacing tuned per orientation. family-chart swaps the X/Y
        // pair internally when horizontal, so the centre-to-centre
        // gap each axis enforces *on screen* stays consistent:
        //   X = horizontal screen distance,
        //   Y = vertical screen distance.
        // Cards are 220×64, so X ≥ ~250 to avoid horizontal overlap
        // and Y ≥ ~92 to clear the card height. Vertical mode allows
        // tighter Y because siblings stack horizontally instead.
        built.setTransitionTime(200);
        // Thẻ rộng hơn khi hiện giỗ/thọ (w≈312) → nới khoảng cách ngang
        // tương ứng để các thẻ không đè lên nhau.
        // Khi bật giỗ/thọ thẻ cao hơn (h≈74) → nới cả khoảng cách dọc để
        // vợ-chồng / anh-em xếp dọc không bị sát/chạm nhau.
        const wide = showDeceasedDetails;
        if (orientation === "horizontal") {
          built.setOrientationHorizontal?.();
          // Generations flow left→right → X must clear card width.
          // Siblings stack top→bottom → Y must clear card height.
          built.setCardXSpacing(wide ? 300 : 280).setCardYSpacing(wide ? 116 : 92);
        } else {
          built.setOrientationVertical?.();
          // Siblings stack left→right → X must clear card width.
          // Generations flow top→bottom → Y must clear card height.
          built.setCardXSpacing(wide ? 282 : 250).setCardYSpacing(wide ? 168 : 152);
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
  }, [
    f3Data,
    focal,
    orientation,
    clan.generation_offset,
    clan.display_death_details,
    clan.display_living_full_dob,
  ]);

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

  // Search-by-name → set focal. Diacritic-insensitive so "Hung" finds
  // "Hùng". 8 results was too few for a big clan ("Nguyễn" often hits
  // hundreds); cap at 50 and scroll inside the popover so the list
  // stays compact but reachable.
  const SEARCH_CAP = 50;
  const { matches, totalMatched } = useMemo(() => {
    if (!data || !search.trim()) return { matches: [], totalMatched: 0 };
    const filtered = data.persons.filter((p) => matchesName(p.full_name, search));
    return { matches: filtered.slice(0, SEARCH_CAP), totalMatched: filtered.length };
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

      <div className="print-hide">
        <PageHeader
          icon={<IconTree className="h-7 w-7" />}
          title="Cây gia phả"
          description="Sơ đồ phả hệ — zoom/pan, đặt người làm tâm, đổi hướng."
          actionsBelow
          actions={
            <>
              <SegmentedControl ariaLabel="Hướng cây">
                <SegmentedButton
                  active={orientation === "vertical"}
                  onClick={() => setOrientation("vertical")}
                  title="Dọc — gốc ở trên, đời con xuống dưới"
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3"
                >
                  <IconLayoutVertical className="h-4 w-4" />
                  Dọc
                </SegmentedButton>
                <SegmentedButton
                  active={orientation === "horizontal"}
                  onClick={() => setOrientation("horizontal")}
                  title="Ngang — gốc ở trái, đời con sang phải"
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3"
                >
                  <IconLayoutHorizontal className="h-4 w-4" />
                  Ngang
                </SegmentedButton>
              </SegmentedControl>
              {effectiveRole(clan) !== null && (
                <>
                  <ExportBookButton clan={clan} />
                  <ShareTreeButton clanId={clan.id} clanName={clan.name} />
                </>
              )}
              <RefreshButton
                clanId={clan.id}
                cachedVersion={clan.data_version}
                compact
              />
            </>
          }
        />
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
          <div className="relative print-hide">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <SearchInput
                  label="Đặt người trung tâm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Đặt người trung tâm — gõ tên để tìm…"
                />
              </div>
              {defaultFocal && focal !== defaultFocal && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0 w-10 sm:w-auto px-0 sm:px-3"
                  onClick={() => {
                    setFocal(defaultFocal);
                    setSearch("");
                  }}
                  aria-label="Về Thuỷ tổ"
                  title={
                    focalName
                      ? `Đang chính giữa là ${focalName}. Bấm để về Thuỷ tổ.`
                      : "Về Thuỷ tổ"
                  }
                >
                  <IconHome className="h-4 w-4 sm:mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">Về Thuỷ tổ</span>
                </Button>
              )}
            </div>
            {matches.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-md border bg-card shadow-lg z-20">
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/30">
                  {totalMatched > SEARCH_CAP
                    ? `Hiện ${SEARCH_CAP} / ${totalMatched} kết quả — gõ thêm để thu hẹp`
                    : `${totalMatched} kết quả`}
                </div>
                <ul className="max-h-80 overflow-y-auto divide-y">
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
              </div>
            )}
          </div>

          <div className="relative">
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
                  // Only opt out of native scroll when the chart is
                  // "active" — otherwise we let the page scroll
                  // through, important on phones where the chart
                  // takes up the entire viewport.
                  touchAction: chartActive ? "none" : "auto",
                } as React.CSSProperties
              }
              aria-label="Cây gia phả tương tác"
            />
            {!chartActive && (
              <button
                type="button"
                data-testid="tree-activate-overlay"
                onClick={() => setChartActive(true)}
                className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/40 backdrop-blur-[1px] print-hide"
                style={{ touchAction: "pan-y" }}
                aria-label="Mở chế độ di chuyển cây"
              >
                <span className="px-4 py-2 rounded-full bg-card border shadow text-sm font-medium">
                  Chạm để di chuyển / phóng to cây
                </span>
              </button>
            )}
            {chartActive && (
              <div
                className="absolute bottom-2 right-2 z-10 flex flex-col gap-1 print-hide"
                aria-label="Phóng to / thu nhỏ cây"
              >
                <button
                  type="button"
                  data-testid="tree-zoom-in"
                  onClick={() => zoomBy(1.3)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 border shadow-sm text-foreground hover:bg-card hover:border-primary backdrop-blur-sm text-lg font-medium"
                  aria-label="Phóng to"
                  title="Phóng to"
                >
                  +
                </button>
                <button
                  type="button"
                  data-testid="tree-zoom-out"
                  onClick={() => zoomBy(1 / 1.3)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 border shadow-sm text-foreground hover:bg-card hover:border-primary backdrop-blur-sm text-lg font-medium"
                  aria-label="Thu nhỏ"
                  title="Thu nhỏ"
                >
                  −
                </button>
              </div>
            )}
            {chartActive && (
              <button
                type="button"
                onClick={() => setChartActive(false)}
                className="hidden [@media(hover:none)]:inline-flex absolute top-2 right-2 z-10 items-center gap-1 px-2.5 py-1.5 rounded-md bg-card/90 border shadow text-xs font-medium backdrop-blur-sm print-hide"
                style={{ touchAction: "pan-y" }}
                title="Tắt chế độ di chuyển cây để cuộn trang"
              >
                Khoá để cuộn trang
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground print-hide">
            {chartActive
              ? 'Vuốt để di chuyển, kéo 2 ngón để phóng to/thu nhỏ. Chạm vào thẻ người để mở rộng nhánh.'
              : 'Khoá để cuộn trang. Chạm vào ảnh cây để mở chế độ di chuyển.'}
          </p>
        </>
      )}

      <InlawBadgeDialog
        personId={badgePersonId}
        userId={userId}
        viewingClanId={clan.id}
        onClose={() => setBadgePersonId(null)}
      />

      <RelationSheet
        open={editPersonId !== null}
        title="Sửa thông tin"
        onClose={() => setEditPersonId(null)}
      >
        {editPersonId && (
          <EditPersonForm
            clanId={clan.id}
            personId={editPersonId}
            onSaved={() => setEditPersonId(null)}
            onCancel={() => setEditPersonId(null)}
          />
        )}
      </RelationSheet>

      <QuickAddSheet
        open={quickAddPersonId !== null}
        onClose={() => setQuickAddPersonId(null)}
        clanId={clan.id}
        personId={quickAddPersonId ?? ""}
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
  viewingClanId,
  onClose,
}: {
  personId: string | null;
  userId: string;
  viewingClanId: string;
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
          <InlawBadgeBody
            personId={personId!}
            userId={userId}
            viewingClanId={viewingClanId}
          />
        </div>
      </div>
    </div>
  );
}

function InlawBadgeBody({
  personId,
  userId,
  viewingClanId,
}: {
  personId: string;
  userId: string;
  viewingClanId: string;
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
          <InlawFamilyCard linkId={l.id} viewingClanId={viewingClanId} />
        </div>
      ))}
    </div>
  );
}

// ─── Export sổ PDF button ──────────────────────────────────────────
// Lazy-imports the PDF renderer (react-pdf bundle is heavy) so the
// Tree page still loads quickly when the user never clicks export.

function ExportBookButton({ clan }: { clan: ClanDetail }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const { downloadClanBookPdf } = await import("@/lib/pdf/exportClanBook");
      await downloadClanBookPdf(clan, { tree: true, detail: true });
      track("export", { kind: "clan_book_pdf", from: "tree" });
      toast.success("Đã tải sổ PDF");
    } catch (e) {
      toast.error("Không xuất được", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 px-2.5 sm:px-3"
      onClick={onClick}
      disabled={busy}
      aria-label="Xuất sổ PDF"
      title="Xuất toàn bộ thông tin dòng họ thành sổ PDF"
    >
      <IconDownload className="h-4 w-4 sm:mr-1.5" />
      <span className="hidden sm:inline">
        {busy ? "Đang xuất…" : "Xuất sổ"}
      </span>
    </Button>
  );
}
