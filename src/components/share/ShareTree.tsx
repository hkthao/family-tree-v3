import { lockBodyScroll } from "@/lib/scrollLock";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  IconDownload,
  IconMaximize,
  IconMinimize,
  IconSliders,
  IconUser,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { track } from "@/lib/analytics";
import { bloodlineIds } from "@/lib/bloodline";
import type { TreeData } from "@/lib/queries/tree";

// Lazy — kéo three.js + 3d-force-graph ra chunk riêng, chỉ tải khi bật 3D.
const Tree3DView = lazy(() =>
  import("@/components/Tree3DView").then((m) => ({ default: m.Tree3DView })),
);
import { FilterDrawer } from "@/components/FilterDrawer";
import { FilterableSelect } from "@/components/FilterableSelect";
import { TreeBackdrop } from "@/components/tree/TreeBackdrop";
import { TreeGuide } from "@/components/tree/TreeGuide";
import { TreeOptionsPanel } from "@/components/tree/TreeOptionsPanel";
import { useTreeViewPrefs } from "@/lib/tree/viewPrefs";
import { nameFontFamily as fontFamilyOf } from "@/lib/tree/nameFonts";
import { pickDefaultFocal, toFamilyChart } from "@/lib/familyChartAdapter";
import { type ShareViewPayload } from "@/lib/queries/share-view";

import "family-chart/styles/family-chart.css";
import {
  layoutTallText,
  tallMetrics,
  titleCaseName,
} from "@/lib/tree/tallCard";

import { t } from "@lingui/core/macro";

type DatumNode = {
  id?: string;
  data?: Record<string, unknown>;
};

interface F3Card {
  setCardDisplay: (lines: ((d: unknown) => string)[] | string[][]) => F3Card;
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
  setOnCardClick?: (
    fn: (e: MouseEvent, d: { data?: { id?: string } }) => void,
  ) => F3Card;
  onCardClickDefault?: (e: MouseEvent, d: unknown) => void;
}

interface F3Chart {
  setTransitionTime: (n: number) => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setCardYSpacing: (n: number) => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setOrientationHorizontal?: () => F3Chart;
  setProgenyDepth?: (n: number) => F3Chart;
  setAncestryDepth?: (n: number) => F3Chart;
  updateTree: (opts: {
    initial?: boolean;
    tree_position?: "fit" | "main_to_middle" | "inherit";
    scale?: number;
    transition_time?: number;
  }) => void;
  updateMainId?: (id: string) => void;
}

type Orientation = "vertical" | "horizontal";

let f3Module: typeof import("family-chart") | null = null;
async function loadF3(): Promise<typeof import("family-chart")> {
  if (!f3Module) f3Module = await import("family-chart");
  return f3Module;
}

export interface ShareTreeProps {
  data: ShareViewPayload;
  /** false: ẩn bằng CSS nhưng giữ cây đã dựng (đổi tab không phải dựng lại). */
  visible?: boolean;
  className?: string;
  /** Người đang làm tâm (đổi khi bấm thẻ / chọn trong ô). */
  onFocalChange?: (id: string) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Người làm tâm ban đầu (vd. từ kết quả tìm kiếm `?p=`); id không có trong cây thì bỏ qua. */
  initialFocal?: string | null;
  /** Nút phụ đặt cạnh ô chọn người (vd. "Xem hồ sơ" của trang dòng họ). */
  toolbarExtra?: React.ReactNode;
}

/**
 * Khối cây gia phả chỉ-xem dùng chung cho màn Share (tab Cây) và trang dòng họ: thanh chọn người trung tâm + ngăn
 * Tuỳ chọn cây, khung cây 2D (family-chart) / 3D, hướng dẫn, xuất ảnh, toàn màn hình. Tách nguyên văn khỏi Share.tsx.
 */
export function ShareTree({
  data,
  visible = true,
  className,
  onFocalChange,
  onFullscreenChange,
  initialFocal,
  toolbarExtra,
}: ShareTreeProps) {
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
    const releaseScroll = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(refit);
      releaseScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  // `focal` starts as null and becomes the user's choice (or a default
  // picked from the data) once we have it. We don't gate the chart on
  // it — family-chart picks its own default main when none is set.
  const [focal, setFocal] = useState<string | null>(() =>
    initialFocal && data.persons.some((p) => p.id === initialFocal)
      ? initialFocal
      : null,
  );
  const toast = useToast();
  // Xuất ảnh cây đang xem (PNG) — dùng chung helper với trang Cây chính.
  const [savingImg, setSavingImg] = useState(false);
  const exportShareImage = async () => {
    const el = containerRef.current;
    if (!el || savingImg) return;
    setSavingImg(true);
    try {
      const { exportFamilyChartPng, fileSlug } =
        await import("@/lib/tree/exportTreePng");
      const focalName = focal
        ? (data?.persons.find((p) => p.id === focal)?.full_name ?? "")
        : "";
      const slug = fileSlug(focalName);
      await exportFamilyChartPng(el, `cay-gia-pha-${slug || "share"}.png`);
      track("export", { kind: "tree_image", from: "share" });
      toast.success(t`Đã xuất ảnh cây gia phả.`);
    } catch {
      toast.error(t`Không xuất được ảnh. Thử lại sau.`);
    } finally {
      setSavingImg(false);
    }
  };
  // Chế độ cây: 2D (family-chart) | 3D (Tree3DView). Áp cho cả share-link lẫn
  // trang xem trước công khai.
  const [treeMode, setTreeMode] = useState<"2d" | "3d">("2d");
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  // Số đời hiển thị quanh người làm tâm — mặc định 3 để họ lớn không
  // render toàn bộ gây lag trên điện thoại. 0 = tất cả.
  const [depth, setDepth] = useState<number>(8);
  const [showOpts, setShowOpts] = useState(false);
  // Kiểu thẻ: dọc (hẹp, xem được nhiều người) hoặc ngang; ảnh mặc định ẩn.
  // Nền / khung / kiểu thẻ / ảnh / font / avatar: dùng CHUNG với trang Cây (lib/tree/viewPrefs).
  const prefs = useTreeViewPrefs();
  const { cardLayout, cardAvatar, cardFrame, nameFont, backdrop, avatarStyle } =
    prefs;

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
    return toFamilyChart(adapted, data.families, photoByPath, avatarStyle);
  }, [data, avatarStyle]);

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
    // Tập huyết thống để đánh dấu dâu/rể (viền đứt) chính xác.
    const blood = data
      ? bloodlineIds(
          data.persons.map((p) => ({
            id: p.id,
            is_root: p.is_root,
            birth_family_id: p.birth_family_id,
          })),
          data.families.map((f) => ({
            id: f.id,
            husband_id: f.husband_id,
            wife_id: f.wife_id,
          })),
        )
      : new Set<string>();
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

        const card = (
          built as F3Chart & {
            setCardSvg?: () => F3Card;
          }
        ).setCardSvg?.();

        const lifespan = (d: DatumNode): string => {
          const f = d.data ?? {};
          const b = (f["birthday"] as string) || "?";
          const isLiving = f["is_living"] !== false;
          const death = (f["death_year"] as string) || (isLiving ? "" : "?");
          return death ? `${b} - ${death}` : b;
        };

        // Bấm thẻ: giữ hành vi mặc định (đổi người trung tâm) + ghi lại người
        // đang chọn để tab "Chi tiết" hiện đúng người.
        card?.setOnCardClick?.((e, d) => {
          card.onCardClickDefault?.(e, d);
          if (d.data?.id) setFocal(d.data.id);
        });

        const tall = cardLayout === "tall";
        const tm = tallMetrics(
          (f3Data as { data?: Record<string, unknown> }[]).map((n) =>
            String(n.data?.["full name"] ?? ""),
          ),
          { showAvatar: cardAvatar },
        );
        const CW = tall ? tm.w : 220;
        const CH = tall ? tm.h : 64;
        card
          ?.setCardDisplay([
            (d) =>
              titleCaseName(String((d as DatumNode).data?.["full name"] ?? "")),
            (d) => lifespan(d as DatumNode),
          ])
          .setCardDim(
            tall
              ? {
                  w: tm.w,
                  h: tm.h,
                  text_x: tm.textX,
                  text_y: tm.nameTop,
                  img_w: 50,
                  img_h: 50,
                  img_x: tm.imgX,
                  img_y: tm.imgY,
                }
              : {
                  w: 220,
                  h: 64,
                  text_x: 64,
                  text_y: 18,
                  img_w: 50,
                  img_h: 50,
                  img_x: 8,
                  img_y: 7,
                },
          )
          .setOnCardUpdate(function (d) {
            const datum = d.data as DatumNode | undefined;
            const fields = datum?.data ?? {};

            const tspans = this.querySelectorAll<SVGTSpanElement>(
              ".card-text text tspan",
            );
            if (tall) {
              if (!cardAvatar) this.querySelector(".card_image")?.remove();
              layoutTallText(
                Array.from(tspans),
                String(fields["full name"] ?? ""),
                tm,
              );
            }
            const meta = tall ? null : tspans[1];
            if (meta) {
              meta.setAttribute("text-anchor", "start");
              meta.setAttribute("x", "0");
              meta.setAttribute("dy", "18");
            }

            // Khung thẻ hoàng gia: viền vàng + chỉ vàng trong + hoa văn đủ 4 góc
            // (triện Đời lùi vào trong nên không đè góc trên-phải). Dâu/rể = KHÔNG thuộc
            // huyết thống (đúng cả khi có cha/mẹ ghi) → viền đứt.
            {
              const inLaw = !!datum?.id && !blood.has(datum.id);
              const rect = this.querySelector(".card-body rect");
              if (rect && cardFrame === "simple") {
                // Khung đơn giản: giữ viền mặc định, chỉ dâu/rể có viền đứt.
                if (inLaw) {
                  rect.setAttribute("stroke", "#B8862A");
                  rect.setAttribute("stroke-dasharray", "4 3");
                  rect.setAttribute("stroke-width", "1.5");
                }
              } else if (rect) {
                rect.setAttribute("rx", "4");
                rect.setAttribute("ry", "4");
                rect.setAttribute("stroke", "#B8862A");
                rect.setAttribute("stroke-width", inLaw ? "1.5" : "1.2");
                if (inLaw) rect.setAttribute("stroke-dasharray", "4 3");
                this.querySelector(".card-body .card-inner-line")?.remove();
                this.querySelector(".card-body .card-corners")?.remove();
                const ns = "http://www.w3.org/2000/svg";
                const W = CW;
                const H = CH;
                const line = document.createElementNS(ns, "rect");
                line.setAttribute("class", "card-inner-line");
                line.setAttribute("x", "3");
                line.setAttribute("y", "3");
                line.setAttribute("width", String(W - 6));
                line.setAttribute("height", String(H - 6));
                line.setAttribute("rx", "2");
                line.setAttribute("fill", "none");
                line.setAttribute("stroke", "#D4A94A");
                line.setAttribute("stroke-width", "0.6");
                line.setAttribute("opacity", "0.4");
                line.setAttribute("pointer-events", "none");
                rect.parentNode?.insertBefore(line, rect.nextSibling);
                const L = 7;
                const o = 3;
                const corners = document.createElementNS(ns, "path");
                corners.setAttribute("class", "card-corners");
                corners.setAttribute(
                  "d",
                  [
                    `M${o} ${o + L}V${o}H${o + L}`,
                    `M${o} ${H - o - L}V${H - o}H${o + L}`,
                    `M${W - o - L} ${o}H${W - o}V${o + L}`,
                    `M${W - o - L} ${H - o}H${W - o}V${H - o - L}`,
                  ].join(""),
                );
                corners.setAttribute("fill", "none");
                corners.setAttribute("stroke", "#D4A94A");
                corners.setAttribute("stroke-width", "1.4");
                corners.setAttribute("stroke-linecap", "round");
                corners.setAttribute("pointer-events", "none");
                line.parentNode?.insertBefore(corners, line.nextSibling);
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
                <rect x="${CW - 30}" y="6" width="24" height="18" rx="2"
                      fill="#7A2E2E" />
                <rect class="seal-in" x="${CW - 28}" y="8" width="20" height="14"
                      rx="1" fill="none" stroke="#F2D68A" stroke-width="0.8"
                      opacity="0.75" />
                <text x="${CW - 18}" y="18.5" text-anchor="middle"
                      fill="#FFFFFF" font-size="10" font-weight="700"
                      style="font-family: var(--tree-name-font, 'Playfair Display'), Georgia, serif">
                  ${gen - (data?.generation_offset ?? 0)}
                </text>
                <title>${t`Đời ${gen - (data?.generation_offset ?? 0)}`}</title>`;
              this.querySelector(".card-body")?.appendChild(badge);
            }
          });

        built.setTransitionTime(200);
        if (orientation === "horizontal") {
          built.setOrientationHorizontal?.();
          built
            .setCardXSpacing(tall ? CW + 40 : 280)
            .setCardYSpacing(tall ? CH + 20 : 92);
        } else {
          built.setOrientationVertical?.();
          built
            .setCardXSpacing(tall ? CW + 22 : 250)
            .setCardYSpacing(tall ? CH + 58 : 152);
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

        // Tô màu đường nối theo giới người con (con trai vàng kim / con gái vàng hồng),
        // hôn nhân đỏ — đồng bộ với cây 3D. Gắn observer TRƯỚC updateTree.
        const colorLinks = () => {
          const dark = document.documentElement.classList.contains("dark");
          const MALE = dark ? "#D4A94A" : "#B8862A"; // vàng kim
          const FEMALE = dark ? "#D99A8C" : "#C27B6A"; // vàng hồng
          const MARRIAGE = dark ? "#D24545" : "#9B3535";
          node
            .querySelectorAll<SVGPathElement>(".links_view .link")
            .forEach((p) => {
              const d = (
                p as unknown as {
                  __data__?: {
                    spouse?: boolean;
                    source?: unknown;
                    target?: unknown;
                  };
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
        // Cây đông người: không "vừa khít" làm chữ nhỏ — phóng lên mức đọc được.
        const currentK = async (): Promise<number> => {
          const svgEl = node.querySelector("svg.main_svg") as
            (SVGSVGElement & { __zoomObj?: unknown }) | null;
          if (!svgEl) return 1;
          const listener = (
            svgEl.__zoomObj ? svgEl : svgEl.parentElement
          ) as Element;
          const { zoomTransform } = await import("d3-zoom");
          return zoomTransform(listener).k;
        };
        // Điện thoại (khung hẹp): 0,7 để thấy được nhiều thế hệ hơn mà chữ vẫn đọc được; máy tính: 0,85.
        const READABLE_K =
          node.getBoundingClientRect().width < 520 ? 0.7 : 0.85;
        // Dùng cả sau mỗi lần co giãn khung (điện thoại: đổi hướng màn hình, thanh địa chỉ co lại…): refit của family-chart có thể
        // thu cả cây về chữ li ti, nên phải kéo lại mức đọc được quanh người đang chọn.
        const ensureReadable = async () => {
          if (disposed) return;
          if ((await currentK()) < READABLE_K) {
            if (disposed) return;
            built.updateTree({
              initial: false,
              tree_position: "main_to_middle",
              scale: READABLE_K,
              transition_time: 0,
            });
          }
        };
        await ensureReadable();
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
            requestAnimationFrame(() => void ensureReadable());
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
  }, [
    f3Data,
    orientation,
    data?.generation_offset,
    depth,
    isFullscreen,
    treeMode,
    cardLayout,
    cardAvatar,
    cardFrame,
    nameFont,
  ]);

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

  // Danh sách chọn người trung tâm: theo đời rồi theo tên; nhãn kèm đời + năm sinh để phân biệt trùng tên.
  const personOptions = useMemo(() => {
    if (!data) return [];
    const off = data.generation_offset ?? 0;
    return [...data.persons]
      .sort(
        (x, y) =>
          (x.generation ?? 999) - (y.generation ?? 999) ||
          x.full_name.localeCompare(y.full_name, "vi"),
      )
      .map((p) => ({
        value: p.id,
        label: [
          p.full_name,
          p.generation !== null ? t`Đời ${p.generation - off}` : null,
          p.birth_date ? t`sinh ${p.birth_date.slice(0, 4)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }));
  }, [data]);

  // Đổi `initialFocal` khi đang xem cây (bấm kết quả tìm kiếm khác) → chuyển tâm sang người đó.
  useEffect(() => {
    if (initialFocal && data.persons.some((p) => p.id === initialFocal))
      setFocal(initialFocal);
  }, [initialFocal, data.persons]);
  useEffect(() => {
    if (focal) onFocalChange?.(focal);
  }, [focal, onFocalChange]);
  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);
  // Hiện lại sau khi ẩn (đổi tab) → vừa khít lại khung.
  useEffect(() => {
    if (!visible) return;
    const r = requestAnimationFrame(() =>
      chartRef.current?.updateTree({ initial: false }),
    );
    return () => cancelAnimationFrame(r);
  }, [visible]);

  return (
    <div
      className={`${visible ? "flex flex-1 min-h-0 flex-col" : "hidden"} ${className ?? ""}`}
    >
      {/* Thanh công cụ gọn: ô chọn người trung tâm (có ô tìm), icon Tuỳ chọn cây nằm trong ô. */}
      <div className="container flex max-w-6xl shrink-0 items-center gap-2 py-3 print-hide">
        <div className="min-w-0 flex-1">
          <FilterableSelect
            id="share-focal"
            icon={<IconUser />}
            value={focal ?? ""}
            onChange={(v) => v && setFocal(v)}
            options={personOptions}
            emptyLabel={t`Chọn thuỷ tổ làm trung tâm`}
            filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
            filterLabel={t`Tìm người làm trung tâm`}
            className="h-10 pr-[4.25rem] text-sm"
            rightSlot={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                onClick={() => setShowOpts(true)}
                aria-haspopup="dialog"
                aria-expanded={showOpts}
                aria-label={t`Tuỳ chọn cây`}
                title={t`Tuỳ chọn`}
              >
                <IconSliders className="h-4 w-4" />
              </button>
            }
          />
        </div>
        {toolbarExtra}
      </div>

      <FilterDrawer
        open={showOpts}
        onClose={() => setShowOpts(false)}
        title={t`Tuỳ chọn cây`}
      >
        <TreeOptionsPanel
          prefs={prefs}
          mode={treeMode}
          onModeChange={(m) => setTreeMode(m === "3d" ? "3d" : "2d")}
          modes={["2d", "3d"]}
          depth={depth}
          onDepthChange={setDepth}
          orientation={orientation}
          onOrientationChange={setOrientation}
        />
      </FilterDrawer>

      {/* Điện thoại: cây tràn mép cho rộng; từ sm: nằm trong khung có viền, cùng bề rộng với phần trên. */}
      <div className="container flex min-h-0 max-w-6xl flex-1 flex-col px-0 sm:px-4 sm:pb-3">
        {treeMode === "3d" && tree3dData ? (
          <div className="relative min-h-0 w-full flex-1 overflow-hidden border-y sm:rounded-lg sm:border">
            <Suspense
              fallback={
                <p className="p-8 text-center text-muted-foreground">
                  {t`Đang dựng cây 3D…`}
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
                  : "relative min-h-0 w-full flex-1 overflow-hidden border-y sm:rounded-lg sm:border"
              }
            >
              <TreeBackdrop backdrop={backdrop} />
              <div
                ref={containerRef}
                className="f3 relative h-full w-full bg-transparent text-foreground"
                style={
                  {
                    "--male-color": "var(--tree-card-male)",
                    "--female-color": "var(--tree-card-female)",
                    "--tree-name-font": fontFamilyOf(nameFont),
                  } as React.CSSProperties
                }
                aria-label={t`Cây gia phả tương tác (chỉ xem)`}
              />
              {/* Cách xem: mở sẵn trên máy tính, thu gọn thành nút trên điện thoại để khỏi che cây. */}
              <TreeGuide
                defaultOpen={
                  typeof window === "undefined" ||
                  window.matchMedia("(min-width: 640px)").matches
                }
              />
              <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={exportShareImage}
                  disabled={savingImg}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 border shadow-sm text-foreground hover:bg-card hover:border-primary backdrop-blur-sm disabled:opacity-60"
                  aria-label={t`Xuất ảnh cây đang hiển thị (PNG)`}
                  title={savingImg ? t`Đang xuất…` : t`Xuất ảnh cây (PNG)`}
                >
                  <IconDownload className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 border shadow-sm text-foreground hover:bg-card hover:border-primary backdrop-blur-sm"
                  aria-label={
                    isFullscreen ? t`Thoát toàn màn hình` : t`Xem toàn màn hình`
                  }
                  title={
                    isFullscreen ? t`Thoát toàn màn hình` : t`Xem toàn màn hình`
                  }
                >
                  {isFullscreen ? (
                    <IconMinimize className="h-4 w-4" />
                  ) : (
                    <IconMaximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>,
          )
        )}
      </div>
    </div>
  );
}
