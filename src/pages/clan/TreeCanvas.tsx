import { useQuery, useQueryClient } from "@tanstack/react-query";
import type Konva from "konva";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import { useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { IconDownload, IconMaximize, IconPlus, IconRefresh, IconTree, IconUndo, IconUpload } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  CanvasPalette,
  LinkInspector,
  NodeInspector,
  PALETTE_MIME,
  type PaletteItem,
} from "@/components/treeCanvas/CanvasPalette";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData, type PersonForTree } from "@/lib/queries/tree";
import {
  createTreeCanvas,
  deleteTreeCanvas,
  listTreeCanvases,
  updateTreeCanvas,
} from "@/lib/queries/treeCanvas";
import {
  anchor,
  autoLayout,
  buildEdges,
  CANVAS_FONTS,
  contentBounds,
  coverCrop,
  DEFAULT_LAYOUT,
  edgePoints,
  linkAnchors,
  NODE_H,
  NODE_W,
  nodeRect,
  paperSizeMm,
  TEXT_H,
  TEXT_W,
  tidyPositions,
  type CanvasBackground,
  type CanvasLayout,
  type CardDesign,
  type CustomLink,
  type EdgeStyle,
  type ExtraItem,
  type NodeFrame,
  type NodeStyle,
  type PaperPreset,
} from "@/lib/tree/canvasModel";

const FONT = '"Be Vietnam Pro", system-ui, sans-serif';

const FRAME_COLOR: Record<NodeFrame, { stroke: string; fill: string; inner: string }> = {
  gold: { stroke: "#B8862A", fill: "#FBF6EA", inner: "#E4C873" },
  wine: { stroke: "#8B1E2D", fill: "#FBF1EF", inner: "#C98A92" },
  jade: { stroke: "#2F7D5B", fill: "#F1F8F4", inner: "#8CC2A6" },
  none: { stroke: "#B9B0A3", fill: "#FFFFFF", inner: "#B9B0A3" },
};

const BG_STYLE: Record<CanvasBackground, { base: string; line: string; edge: string }> = {
  paper: { base: "#F3EBDD", line: "rgba(139,110,70,.12)", edge: "#8A7A64" },
  lattice: { base: "#F7F2E8", line: "rgba(139,30,45,.16)", edge: "#8B1E2D" },
  plain: { base: "#FFFFFF", line: "transparent", edge: "#6B6359" },
  dark: { base: "#211C19", line: "rgba(255,255,255,.07)", edge: "#C9B88F" },
};

// ─── ảnh (cache theo URL, crossOrigin để xuất canvas không bị "tainted") ───
const imgCache = new Map<string, HTMLImageElement | "fail">();
function useImage(url: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(() => {
    const c = url ? imgCache.get(url) : null;
    return c && c !== "fail" ? c : null;
  });
  useEffect(() => {
    if (!url) return setImg(null);
    const c = imgCache.get(url);
    if (c) return setImg(c === "fail" ? null : c);
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      imgCache.set(url, el);
      setImg(el);
    };
    el.onerror = () => imgCache.set(url, "fail");
    el.src = url;
  }, [url]);
  return img;
}

/** Ô lặp (họa tiết nền) vẽ sẵn thành canvas nhỏ → Rect.fillPatternImage, rẻ hơn vẽ từng nét. */
function makeTile(kind: CanvasBackground): HTMLCanvasElement | null {
  if (kind === "plain") return null;
  const size = kind === "lattice" ? 56 : 48;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  g.strokeStyle = BG_STYLE[kind].line;
  g.lineWidth = 1;
  g.beginPath();
  if (kind === "lattice") {
    // Hoa văn ô trám chéo kiểu song cửa Việt.
    g.moveTo(0, size / 2); g.lineTo(size / 2, 0); g.lineTo(size, size / 2); g.lineTo(size / 2, size); g.closePath();
    g.moveTo(size / 2, size / 2); g.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
  } else {
    g.moveTo(0, size - 0.5); g.lineTo(size, size - 0.5);
    g.moveTo(size - 0.5, 0); g.lineTo(size - 0.5, size);
  }
  g.stroke();
  return c;
}

function yearsOf(p: PersonForTree): string {
  const b = p.birth_date?.slice(0, 4);
  const d = !p.is_living ? p.death_date?.slice(0, 4) : null;
  if (b && d) return `${b} – ${d}`;
  if (b) return p.is_living ? `sinh ${b}` : `${b} – ?`;
  if (d) return `? – ${d}`;
  return "";
}

const DESIGN_LOOK: Record<CardDesign, { fill: string; stroke: string; inner: string; text: string; sub: string; border: number }> = {
  classic: { fill: "", stroke: "", inner: "", text: "#2A211B", sub: "#7A6B5A", border: 3 },
  royal: { fill: "#7A1A24", stroke: "#D4AF37", inner: "#E9CF7A", text: "#F6E7B4", sub: "#E3CF95", border: 3 },
  minimal: { fill: "rgba(255,255,255,.88)", stroke: "#D8D0C2", inner: "", text: "#2A211B", sub: "#7A6B5A", border: 1 },
  plaque: { fill: "#2B2420", stroke: "#C9A24A", inner: "#C9A24A", text: "#E8D7A8", sub: "#BDA877", border: 4 },
};

const fontFamily = (id?: string) => CANVAS_FONTS.find((f) => f.id === id)?.family ?? FONT;

interface NodeProps {
  id: string;
  kind: "person" | "card" | "text";
  name: string;
  sub: string;
  gender: "M" | "F";
  generation: number | null;
  living: boolean;
  x: number;
  y: number;
  photoUrl: string | null;
  frame: NodeFrame;
  style: NodeStyle | undefined;
  selected: boolean;
  picked: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
}

const CardNode = memo(function CardNode(p: NodeProps) {
  const fallback = p.gender === "M" ? "/avatars/male-royal.svg" : "/avatars/female-royal.svg";
  const img = useImage(p.photoUrl);
  const fb = useImage(fallback);
  const shown = img ?? fb;
  const design: CardDesign = p.style?.design ?? "classic";
  const look = DESIGN_LOOK[design];
  const fc = FRAME_COLOR[p.frame];
  const fill = design === "classic" ? fc.fill : look.fill;
  const stroke = design === "classic" ? fc.stroke : look.stroke;
  const inner = design === "classic" ? fc.inner : look.inner;
  const bw = design === "classic" ? (p.frame === "none" ? 1 : 3) : look.border;
  const showInner = design === "classic" ? p.frame !== "none" : !!inner;
  const textColor = p.style?.color ?? look.text;
  const family = fontFamily(p.style?.font);
  const nameSize = p.style?.size ?? 14;
  const R = 46;
  const cx = NODE_W / 2;
  const cy = 62;
  const common = {
    x: p.x,
    y: p.y,
    draggable: true,
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => p.onMove(p.id, e.target.x(), e.target.y()),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => p.onMove(p.id, e.target.x(), e.target.y()),
    onClick: () => p.onSelect(p.id),
    onTap: () => p.onSelect(p.id),
    onDblClick: () => p.kind === "person" && p.onOpen(p.id),
    onDblTap: () => p.kind === "person" && p.onOpen(p.id),
  };
  if (p.kind === "text") {
    return (
      <Group {...common}>
        <Rect width={TEXT_W} height={TEXT_H} fill="rgba(0,0,0,0.001)"
          stroke={p.selected ? "#2563EB" : undefined} dash={[4, 3]} strokeWidth={1} />
        <Text text={p.name} width={TEXT_W} fontSize={nameSize} lineHeight={1.2} align="center"
          verticalAlign="middle" height={TEXT_H} fill={p.style?.color ?? "#2A211B"} fontFamily={family}
          fontStyle="bold" />
      </Group>
    );
  }
  return (
    <Group {...common}>
      <Rect
        width={NODE_W} height={NODE_H} cornerRadius={design === "plaque" ? [60, 60, 10, 10] : 14}
        fill={fill} stroke={stroke} strokeWidth={bw}
        shadowColor="#000" shadowBlur={design === "minimal" ? 0 : 8} shadowOpacity={0.18} shadowOffsetY={2}
      />
      {showInner && (
        <Rect x={6} y={6} width={NODE_W - 12} height={NODE_H - 12} cornerRadius={design === "plaque" ? [54, 54, 6, 6] : 10}
          stroke={inner} strokeWidth={1} dash={[4, 3]} listening={false} />
      )}
      {showInner && design !== "plaque" && [[10, 10], [NODE_W - 10, 10], [10, NODE_H - 10], [NODE_W - 10, NODE_H - 10]].map(([px, py], i) => (
        <Rect key={i} x={px} y={py} width={7} height={7} offsetX={3.5} offsetY={3.5} rotation={45}
          fill={stroke} listening={false} />
      ))}
      <Group clipFunc={(ctx) => { ctx.arc(cx, cy, R, 0, Math.PI * 2); }} listening={false}>
        <Rect x={cx - R} y={cy - R} width={R * 2} height={R * 2} fill="#E7DFD1" />
        {shown && (() => {
          const iw = shown.naturalWidth || shown.width || 1;
          const ih = shown.naturalHeight || shown.height || 1;
          const sc = Math.max((R * 2) / iw, (R * 2) / ih);
          return <KImage image={shown} x={cx - (iw * sc) / 2} y={cy - R} width={iw * sc} height={ih * sc} />;
        })()}
      </Group>
      <Circle x={cx} y={cy} radius={R} stroke={stroke || "#B9B0A3"} strokeWidth={2} listening={false} />
      {p.generation != null && (
        <Group x={20} y={20} listening={false}>
          <Circle radius={11} fill={stroke || "#8A7A64"} />
          <Text text={String(p.generation)} x={-11} y={-6} width={22} align="center"
            fontSize={11} fontStyle="bold" fill="#fff" fontFamily={FONT} />
        </Group>
      )}
      <Text text={p.name} x={8} y={118} width={NODE_W - 16} height={44}
        align="center" verticalAlign="top" fontSize={nameSize} fontStyle="bold" lineHeight={1.2}
        ellipsis fill={textColor} fontFamily={family} listening={false} />
      <Text text={p.sub} x={8} y={NODE_H - 28} width={NODE_W - 16} align="center"
        fontSize={11} fill={p.style?.color ?? look.sub} fontFamily={family} listening={false} />
      {(p.selected || p.picked) && (
        <Rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} cornerRadius={16}
          stroke={p.picked ? "#F59E0B" : "#2563EB"} strokeWidth={3} dash={[8, 4]} listening={false} />
      )}
    </Group>
  );
});

type Tab = "idle" | "export" | "save" | "options";

/** Đọc ảnh người dùng chọn, thu nhỏ ≤1600px và nén JPEG để nhét vừa bố cục (≤ ~700KB). */
async function fileToBgDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new window.Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error("Không đọc được ảnh"));
      el.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const out = c.toDataURL("image/jpeg", q);
      if (out.length < 700_000) return out;
    }
    throw new Error("Ảnh nền quá nặng, hãy chọn ảnh nhỏ hơn");
  } finally {
    URL.revokeObjectURL(url);
  }
}

let extraSeq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(extraSeq++).toString(36)}`;

type Sel = { kind: "node" | "link"; id: string } | null;

export default function TreeCanvas() {
  const { clan } = useClanContext();
  const canEdit = canEditClan(clan);
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const treeSource = effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
    enabled: !!userId,
  });
  const photoPaths = useMemo(
    () => [...new Set((data?.persons ?? []).map((p) => p.photo_path).filter((x): x is string => !!x))],
    [data],
  );
  const { data: photoUrls } = useQuery({
    queryKey: ["signed-photos-batch", clan.id, "canvas", photoPaths],
    queryFn: () => getSignedPhotoUrlMap(photoPaths),
    enabled: photoPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });
  const { data: canvases } = useQuery({
    queryKey: ["tree-canvases", clan.id],
    queryFn: () => listTreeCanvases(clan.id),
    enabled: !!userId,
  });

  const [layout, setLayout] = useState<CanvasLayout>(DEFAULT_LAYOUT);
  const [currentId, setCurrentId] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("idle");
  const [saveName, setSaveName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);

  /** Mọi thay đổi bố cục đi qua đây để đánh dấu "chưa lưu". */
  const update = useCallback((fn: (l: CanvasLayout) => CanvasLayout) => {
    setLayout(fn);
    setDirty(true);
  }, []);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !canvases) return;
    initRef.current = true;
    if (canvases[0]) {
      setCurrentId(canvases[0].id);
      setLayout(canvases[0].layout);
    }
  }, [canvases]);

  const persons = data?.persons ?? [];
  const families = data?.families ?? [];
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const auto = useMemo(() => autoLayout(persons, families), [persons, families]);
  const hiddenIds = useMemo(
    () => new Set(Object.entries(layout.nodeStyles).filter(([, s]) => s.hidden).map(([id]) => id)),
    [layout.nodeStyles],
  );
  const visiblePersons = useMemo(() => persons.filter((p) => !hiddenIds.has(p.id)), [persons, hiddenIds]);
  const extraById = useMemo(() => new Map(layout.extras.map((e) => [e.id, e])), [layout.extras]);

  const positions = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    for (const p of visiblePersons) out[p.id] = layout.positions[p.id] ?? auto[p.id];
    for (const e of layout.extras) out[e.id] = layout.positions[e.id] ?? { x: 0, y: 0 };
    return out;
  }, [auto, layout.positions, layout.extras, visiblePersons]);

  const edges = useMemo(
    () => buildEdges(visiblePersons, families),
    [visiblePersons, families],
  );
  const spouseOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of families) {
      if (f.husband_id && f.wife_id) { m.set(f.husband_id, f.wife_id); m.set(f.wife_id, f.husband_id); }
    }
    return m;
  }, [families]);

  // ─── khung nhìn ───
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const bgImgRef = useRef<Konva.Image>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const bounds = useMemo(() => contentBounds(positions), [positions]);
  const fit = useCallback(() => {
    const s = Math.min(size.w / bounds.w, size.h / bounds.h, 1.5);
    setView({
      scale: s,
      x: (size.w - bounds.w * s) / 2 - bounds.x * s,
      y: (size.h - bounds.h * s) / 2 - bounds.y * s,
    });
  }, [size, bounds]);
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || persons.length === 0) return;
    fitted.current = true;
    fit();
  }, [persons.length, fit]);

  const zoomBy = (factor: number, cx = size.w / 2, cy = size.h / 2) =>
    setView((v) => {
      const ns = Math.min(3, Math.max(0.05, v.scale * factor));
      const k = ns / v.scale;
      return { scale: ns, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });

  // Font web tải xong thì vẽ lại (canvas không tự cập nhật khi font đến muộn).
  useEffect(() => {
    void import("@/lib/cards/fonts").then((m) =>
      m.ensureCardFontsLoaded().then(() => stageRef.current?.batchDraw()),
    );
  }, [layout.nodeStyles]);

  // ─── ảnh nền ───
  const bgImg = useImage(layout.bgImage);
  const placeBgImage = useCallback(
    (r: { x: number; y: number; w: number; h: number }) => {
      const node = bgImgRef.current;
      if (!node || !bgImg) return;
      const c = coverCrop(bgImg.naturalWidth || bgImg.width, bgImg.naturalHeight || bgImg.height, r.w, r.h);
      node.setAttrs({ x: r.x, y: r.y, width: r.w, height: r.h, crop: c });
    },
    [bgImg],
  );
  useEffect(() => {
    placeBgImage(bounds);
    stageRef.current?.batchDraw();
  }, [bounds, placeBgImage]);

  // ─── thao tác trên canvas ───
  const onMove = useCallback((id: string, x: number, y: number) => {
    setLayout((l) => ({ ...l, positions: { ...l.positions, [id]: { x, y } } }));
    setDirty(true);
  }, []);
  const onOpen = useCallback(
    (id: string) => navigate(`/clans/${clan.id}/people/${id}`),
    [navigate, clan.id],
  );
  const onSelect = useCallback(
    (id: string) => {
      if (linkMode) {
        if (!linkFrom) return setLinkFrom(id);
        if (linkFrom === id) return setLinkFrom(null);
        const lk: CustomLink = {
          id: newId("l"), from: linkFrom, to: id, color: "#8B1E2D", width: 3, dash: false, style: "bezier",
        };
        update((l) => ({ ...l, links: [...l.links, lk] }));
        setLinkFrom(null);
        setSel({ kind: "link", id: lk.id });
        return;
      }
      setSel({ kind: "node", id });
    },
    [linkMode, linkFrom, update],
  );

  const toCanvas = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return {
      x: (clientX - (r?.left ?? 0) - view.x) / view.scale,
      y: (clientY - (r?.top ?? 0) - view.y) / view.scale,
    };
  };

  /** Thêm mục từ bảng trái tại toạ độ canvas `at` (mặc định: giữa khung nhìn). */
  const addItem = (item: PaletteItem, at?: { x: number; y: number }) => {
    const c = at ?? {
      x: (size.w / 2 - view.x) / view.scale - NODE_W / 2,
      y: (size.h / 2 - view.y) / view.scale - NODE_H / 2,
    };
    if (item.t === "person") {
      update((l) => ({
        ...l,
        positions: { ...l.positions, [item.id]: c },
        nodeStyles: { ...l.nodeStyles, [item.id]: { ...l.nodeStyles[item.id], hidden: undefined } },
      }));
      setSel({ kind: "node", id: item.id });
      return;
    }
    const ex: ExtraItem =
      item.t === "text"
        ? { id: newId("x"), kind: "text" }
        : { id: newId("x"), kind: "card", gender: item.gender };
    update((l) => ({
      ...l,
      extras: [...l.extras, ex],
      positions: { ...l.positions, [ex.id]: c },
      nodeStyles: {
        ...l.nodeStyles,
        [ex.id]: item.t === "design" ? { design: item.design } : {},
      },
    }));
    setSel({ kind: "node", id: ex.id });
  };

  const patchNode = (id: string, patch: NodeStyle) =>
    update((l) => ({ ...l, nodeStyles: { ...l.nodeStyles, [id]: { ...l.nodeStyles[id], ...patch } } }));

  const removeNode = (id: string) => {
    update((l) => {
      const isExtra = l.extras.some((e) => e.id === id);
      const { [id]: _drop, ...restPos } = l.positions;
      void _drop;
      const links = l.links.filter((k) => k.from !== id && k.to !== id);
      if (isExtra) {
        const { [id]: _s, ...restStyles } = l.nodeStyles;
        void _s;
        return { ...l, extras: l.extras.filter((e) => e.id !== id), positions: restPos, nodeStyles: restStyles, links };
      }
      return { ...l, nodeStyles: { ...l.nodeStyles, [id]: { ...l.nodeStyles[id], hidden: true } }, links };
    });
    setSel(null);
  };
  const patchLink = (id: string, patch: Partial<CustomLink>) =>
    update((l) => ({ ...l, links: l.links.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const removeLink = (id: string) => {
    update((l) => ({ ...l, links: l.links.filter((k) => k.id !== id) }));
    setSel(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") { setLinkMode(false); setLinkFrom(null); setSel(null); }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        sel.kind === "link" ? removeLink(sel.id) : removeNode(sel.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // ─── reset / tự xếp / căn chỉnh ───
  async function doReset() {
    const ok = await confirm({
      title: "Đặt lại canvas?",
      description: "Mọi vị trí, thẻ thêm, đường nối, chữ và nền tuỳ chỉnh sẽ về mặc định (chưa lưu cho tới khi bạn bấm Lưu).",
      confirmLabel: "Đặt lại",
      destructive: true,
    });
    if (!ok) return;
    setLayout(DEFAULT_LAYOUT);
    setSel(null);
    setDirty(true);
    fitted.current = false;
    setTimeout(fit, 0);
  }
  const autoArrange = () => {
    update((l) => {
      const keep: CanvasLayout["positions"] = {};
      for (const e of l.extras) if (l.positions[e.id]) keep[e.id] = l.positions[e.id];
      return { ...l, positions: { ...auto, ...keep } };
    });
    setTimeout(fit, 0);
  };
  const alignTidy = () => {
    const widths: Record<string, number> = {};
    for (const e of layout.extras) widths[e.id] = nodeRect({ x: 0, y: 0 }, e).w;
    const tidy = tidyPositions(positions, widths);
    update((l) => ({ ...l, positions: { ...l.positions, ...tidy } }));
  };

  const setOpt = <K extends "edgeStyle" | "background" | "frame" | "autoEdges">(k: K, v: CanvasLayout[K]) =>
    update((l) => ({ ...l, [k]: v }));

  async function pickBgImage(file: File | undefined) {
    if (!file) return;
    try {
      const url = await fileToBgDataUrl(file);
      update((l) => ({ ...l, bgImage: url }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không dùng được ảnh này");
    }
  }

  const bg = BG_STYLE[layout.background];
  const tile = useMemo(() => makeTile(layout.background), [layout.background]);

  // ─── lưu ───
  const currentCanvas = canvases?.find((c) => c.id === currentId);
  async function save(asNew: boolean) {
    const name = saveName.trim();
    if (!name) return toast.error("Hãy đặt tên cho bố cục");
    setBusy(true);
    try {
      const pos: CanvasLayout["positions"] = {};
      for (const p of persons) pos[p.id] = layout.positions[p.id] ?? auto[p.id];
      for (const e of layout.extras) if (layout.positions[e.id]) pos[e.id] = layout.positions[e.id];
      const body: CanvasLayout = { ...layout, positions: pos };
      if (currentId && !asNew) {
        await updateTreeCanvas(currentId, { name, layout: body });
      } else {
        const c = await createTreeCanvas(clan.id, name, body);
        setCurrentId(c.id);
      }
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      setDirty(false);
      setTab("idle");
      toast.success("Đã lưu bố cục");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!currentId) return;
    setBusy(true);
    try {
      await deleteTreeCanvas(currentId);
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      setCurrentId("");
      setLayout(DEFAULT_LAYOUT);
      setDirty(false);
      setTab("idle");
      toast.success("Đã xoá bố cục");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xoá được");
    } finally {
      setBusy(false);
    }
  }

  // ─── xuất PDF ───
  const [preset, setPreset] = useState<PaperPreset | "custom">("A3");
  const [orient, setOrient] = useState<"auto" | "landscape" | "portrait">("auto");
  const [customW, setCustomW] = useState("100");
  const [customH, setCustomH] = useState("70");
  const [marginCm, setMarginCm] = useState("1");

  const pageMm = useMemo(() => {
    const landscape = orient === "auto" ? bounds.w >= bounds.h : orient === "landscape";
    const cw = Number(customW.replace(",", ".")) || 21;
    const ch = Number(customH.replace(",", ".")) || 29.7;
    return paperSizeMm(preset, landscape, { w: cw, h: ch });
  }, [preset, orient, bounds, customW, customH]);

  async function doExport() {
    const stage = stageRef.current;
    if (!stage || busy) return;
    setBusy(true);
    const prevSel = sel;
    setSel(null);
    try {
      const fonts = await import("@/lib/cards/fonts");
      await fonts.ensureCardFontsLoaded();
      await new Promise((r) => setTimeout(r, 50)); // để bỏ khung chọn trước khi chụp
      const { exportCanvasPdf, canvasPdfFilename } = await import("@/lib/pdf/exportCanvasPdf");
      const name = currentCanvas?.name ?? "canvas";
      const margin = Math.max(0, Number(marginCm.replace(",", ".")) || 0) * 10 * (96 / 25.4);
      const res = await exportCanvasPdf({
        pageMm,
        filename: canvasPdfFilename(clan.name, name),
        render: (wPx, hPx, ratio) => {
          const prev = {
            w: stage.width(), h: stage.height(),
            sx: stage.scaleX(), x: stage.x(), y: stage.y(),
          };
          const s = Math.min((wPx - margin * 2) / bounds.w, (hPx - margin * 2) / bounds.h);
          try {
            stage.size({ width: wPx, height: hPx });
            stage.scale({ x: s, y: s });
            stage.position({
              x: (wPx - bounds.w * s) / 2 - bounds.x * s,
              y: (hPx - bounds.h * s) / 2 - bounds.y * s,
            });
            // Ảnh nền phủ kín cả trang (không chỉ vùng nội dung).
            placeBgImage({ x: -stage.x() / s, y: -stage.y() / s, w: wPx / s, h: hPx / s });
            stage.draw();
            return stage.toDataURL({ mimeType: "image/jpeg", quality: 0.92, pixelRatio: ratio });
          } finally {
            stage.size({ width: prev.w, height: prev.h });
            stage.scale({ x: prev.sx, y: prev.sx });
            stage.position({ x: prev.x, y: prev.y });
            placeBgImage(bounds);
            stage.draw();
          }
        },
      });
      setTab("idle");
      toast.success(`Đã xuất ${res.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xuất được PDF");
    } finally {
      setSel(prevSel);
      setBusy(false);
    }
  }

  const bgRectSize = 200000;

  // ─── bảng trái: thuộc tính mục đang chọn ───
  const selectedLink = sel?.kind === "link" ? layout.links.find((k) => k.id === sel.id) : undefined;
  const selectedExtra = sel?.kind === "node" ? extraById.get(sel.id) : undefined;
  const selectedPerson = sel?.kind === "node" ? personById.get(sel.id) : undefined;
  const inspector = selectedLink ? (
    <LinkInspector link={selectedLink} onChange={(p) => patchLink(selectedLink.id, p)} onRemove={() => removeLink(selectedLink.id)} />
  ) : selectedExtra || selectedPerson ? (
    <NodeInspector
      title={selectedExtra ? (selectedExtra.kind === "text" ? "Ô chữ" : "Thẻ trống") : "Thẻ thành viên"}
      kind={selectedExtra ? selectedExtra.kind : "person"}
      style={layout.nodeStyles[sel!.id] ?? {}}
      defaults={{
        name: selectedPerson?.full_name ?? (selectedExtra?.kind === "text" ? "Nhấp để sửa chữ" : "Họ và tên"),
        sub: selectedPerson ? yearsOf(selectedPerson) : "",
      }}
      onChange={(p) => patchNode(sel!.id, p)}
      onRemove={() => removeNode(sel!.id)}
      removeLabel={selectedExtra ? "Xoá khỏi canvas" : "Ẩn khỏi canvas"}
    />
  ) : null;

  useEffect(() => {
    if (sel) setShowPalette(true);
  }, [sel]);

  const members = useMemo(
    () => persons.map((p) => ({ id: p.id, name: p.full_name, onCanvas: !hiddenIds.has(p.id) })),
    [persons, hiddenIds],
  );

  const palette = (
    <CanvasPalette
      members={members}
      onAdd={(it) => addItem(it)}
      linkMode={linkMode}
      onToggleLink={() => { setLinkMode((v) => !v); setLinkFrom(null); }}
      selection={inspector}
    />
  );

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Dòng họ", to: "/clans" },
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Canvas phả đồ" },
        ]}
      />
      <PageHeader
        icon={<IconTree className="h-6 w-6" />}
        title="Canvas phả đồ"
        description="Kéo thả thẻ thiết kế sẵn, nối đường, sửa chữ, chọn nền rồi xuất PDF khổ tuỳ ý."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Bố cục đã lưu"
          className="h-10 w-auto min-w-[10rem] max-w-[14rem] text-sm"
          value={currentId}
          onChange={(e) => {
            const c = canvases?.find((x) => x.id === e.target.value);
            setCurrentId(e.target.value);
            setLayout(c ? c.layout : DEFAULT_LAYOUT);
            setSel(null);
            setDirty(false);
          }}
        >
          <option value="">Bố cục tự xếp (chưa lưu)</option>
          {canvases?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button size="sm" variant={showPalette ? "default" : "outline"} onClick={() => setShowPalette((v) => !v)}>
          {showPalette ? "Đóng công cụ" : "Công cụ thiết kế"}
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => zoomBy(1 / 1.2)} aria-label="Thu nhỏ">−</Button>
          <Button size="sm" variant="outline" onClick={() => zoomBy(1.2)} aria-label="Phóng to">
            <IconPlus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={fit} aria-label="Vừa khung">
            <IconMaximize className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTab("options")}>Tuỳ chọn</Button>
          {canEdit && (
            <Button size="sm" onClick={() => { setSaveName(currentCanvas?.name ?? ""); setTab("save"); }}>
              Lưu{dirty ? " *" : ""}
            </Button>
          )}
          <Button size="sm" onClick={() => setTab("export")}>
            <IconDownload className="h-4 w-4" /> Xuất PDF
          </Button>
        </div>
      </div>

      <div className="relative">
        <aside
          className={`absolute bottom-16 right-2 top-2 z-10 w-[min(18rem,calc(100%-1rem))] overflow-y-auto rounded-xl border bg-card p-3 shadow-xl transition-transform duration-200 ${showPalette ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+1rem)]"}`}
          aria-hidden={!showPalette}
          data-testid="canvas-palette"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Công cụ thiết kế</span>
            <button type="button" className="rounded-md px-2 py-1 text-sm hover:bg-accent" onClick={() => setShowPalette(false)} aria-label="Đóng công cụ">✕</button>
          </div>
          {palette}
        </aside>

        <div>
          <div
            ref={wrapRef}
            className="relative h-[calc(100dvh-13rem)] min-h-[480px] overflow-hidden rounded-xl border"
            style={{ background: bg.base, touchAction: "none", cursor: linkMode ? "crosshair" : undefined }}
            data-testid="tree-canvas"
            onDragOver={(e) => { if (e.dataTransfer.types.includes(PALETTE_MIME)) e.preventDefault(); }}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData(PALETTE_MIME);
              if (!raw) return;
              e.preventDefault();
              try {
                const at = toCanvas(e.clientX, e.clientY);
                addItem(JSON.parse(raw) as PaletteItem, { x: at.x - NODE_W / 2, y: at.y - 40 });
              } catch { /* dữ liệu kéo không hợp lệ → bỏ qua */ }
            }}
          >
            {isLoading && <p className="p-4 text-sm text-muted-foreground">Đang tải…</p>}
            <Stage
              ref={stageRef}
              width={size.w}
              height={size.h}
              x={view.x}
              y={view.y}
              scaleX={view.scale}
              scaleY={view.scale}
              draggable
              onClick={(e) => { if (e.target === e.target.getStage() || e.target.name() === "bg") setSel(null); }}
              onDragEnd={(e) => {
                if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
              }}
              onWheel={(e) => {
                e.evt.preventDefault();
                const p = e.target.getStage()?.getPointerPosition();
                zoomBy(e.evt.deltaY > 0 ? 1 / 1.1 : 1.1, p?.x, p?.y);
              }}
            >
              <Layer>
                <Rect
                  name="bg"
                  x={-bgRectSize / 2} y={-bgRectSize / 2} width={bgRectSize} height={bgRectSize}
                  fill={bg.base}
                  fillPatternImage={tile ? (tile as unknown as HTMLImageElement) : undefined}
                  fillPatternRepeat="repeat"
                />
                {bgImg && <KImage ref={bgImgRef} image={bgImg} listening={false} />}
              </Layer>
              <Layer listening={false}>
                {layout.autoEdges && edges.map((e, i) => {
                  const a = positions[e.from];
                  const b = positions[e.to];
                  if (!a || !b) return null;
                  if (e.kind === "spouse") {
                    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
                    const p1 = anchor(l, "right");
                    const p2 = anchor(r, "left");
                    return <Line key={i} points={[p1.x, p1.y, p2.x, p2.y]} stroke={bg.edge} strokeWidth={3} />;
                  }
                  const sp = spouseOf.get(e.from);
                  const spPos = sp ? positions[sp] : undefined;
                  let from = anchor(a, "bottom");
                  if (spPos && Math.abs(spPos.y - a.y) < 1) {
                    const o = anchor(spPos, "bottom");
                    from = { x: (from.x + o.x) / 2, y: from.y };
                  }
                  const { points, bezier } = edgePoints(layout.edgeStyle, from, anchor(b, "top"));
                  return (
                    <Line key={i} points={points} bezier={bezier} stroke={bg.edge} strokeWidth={2}
                      lineJoin="round" lineCap="round" />
                  );
                })}
              </Layer>
              <Layer>
                {layout.links.map((k) => {
                  const pa = positions[k.from];
                  const pb = positions[k.to];
                  if (!pa || !pb) return null;
                  const { from, to, vertical } = linkAnchors(
                    nodeRect(pa, extraById.get(k.from)),
                    nodeRect(pb, extraById.get(k.to)),
                  );
                  const { points, bezier } = edgePoints(k.style, from, to, !vertical);
                  const on = sel?.kind === "link" && sel.id === k.id;
                  return (
                    <Line
                      key={k.id}
                      points={points}
                      bezier={bezier}
                      stroke={k.color}
                      strokeWidth={on ? k.width + 2 : k.width}
                      dash={k.dash ? [k.width * 3, k.width * 2] : undefined}
                      lineJoin="round"
                      lineCap="round"
                      hitStrokeWidth={16}
                      onClick={() => setSel({ kind: "link", id: k.id })}
                      onTap={() => setSel({ kind: "link", id: k.id })}
                    />
                  );
                })}
                {[...visiblePersons.map((p) => ({ p, e: undefined as ExtraItem | undefined })),
                  ...layout.extras.map((e) => ({ p: undefined as PersonForTree | undefined, e }))].map(({ p, e }) => {
                  const id = (p?.id ?? e!.id) as string;
                  const pos = positions[id];
                  if (!pos) return null;
                  const st = layout.nodeStyles[id];
                  return (
                    <CardNode
                      key={id}
                      id={id}
                      kind={p ? "person" : e!.kind}
                      name={st?.name ?? p?.full_name ?? (e!.kind === "text" ? "Nhấp để sửa chữ" : "Họ và tên")}
                      sub={st?.sub ?? (p ? yearsOf(p) : "")}
                      gender={p?.gender ?? e?.gender ?? "M"}
                      generation={p?.generation ?? null}
                      living={p?.is_living ?? true}
                      x={pos.x}
                      y={pos.y}
                      photoUrl={p?.photo_path ? (photoUrls?.get(p.photo_path) ?? null) : null}
                      frame={layout.frame}
                      style={st}
                      selected={sel?.kind === "node" && sel.id === id}
                      picked={linkFrom === id}
                      onMove={onMove}
                      onOpen={onOpen}
                      onSelect={onSelect}
                    />
                  );
                })}
              </Layer>
            </Stage>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Kéo thẻ để đổi vị trí · kéo nền để di chuyển · cuộn để thu phóng · nhấp thẻ để sửa ở bảng trái · nhấp đúp để mở hồ sơ · Delete để xoá mục đang chọn.
            {!canEdit && " Bạn chỉ có quyền xem: kéo thử và xuất PDF được nhưng không lưu."}
          </p>
        </div>
      </div>

      <SidePanel
        open={tab === "options"}
        title="Tuỳ chọn canvas"
        subtitle="Nền, khung, đường nối và công cụ căn chỉnh."
        onClose={() => setTab("idle")}
        guard={false}
      >
        <div className="flex flex-1 flex-col space-y-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Bố cục</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" size="sm" onClick={autoArrange}>
                <IconRefresh className="h-4 w-4" /> Tự xếp lại
              </Button>
              <Button variant="outline" size="sm" onClick={alignTidy}>Căn chỉnh</Button>
              <Button variant="destructive-outline" size="sm" onClick={doReset}>
                <IconUndo className="h-4 w-4" /> Đặt lại
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tự xếp lại: xếp lại cả cây theo đời. Căn chỉnh: dồn thẻ cùng hàng, không đè nhau, bám lưới. Đặt lại: về trạng thái ban đầu.
            </p>
          </section>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nền</span>
            <Select value={layout.background} onChange={(e) => setOpt("background", e.target.value as CanvasBackground)}>
              <option value="paper">Giấy kẻ ô</option>
              <option value="lattice">Hoa văn trám</option>
              <option value="plain">Trắng</option>
              <option value="dark">Tối</option>
            </Select>
          </label>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Ảnh nền</span>
            <div className="flex items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-accent">
                <IconUpload className="h-4 w-4" /> Chọn ảnh
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { void pickBgImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {layout.bgImage && (
                <Button size="sm" variant="outline" onClick={() => update((l) => ({ ...l, bgImage: null }))}>Bỏ ảnh nền</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Ảnh phủ kín vùng cây (và cả trang khi xuất PDF), được thu nhỏ để lưu cùng bố cục.</p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Khung thẻ mặc định</span>
            <Select value={layout.frame} onChange={(e) => setOpt("frame", e.target.value as NodeFrame)}>
              <option value="gold">Vàng</option>
              <option value="wine">Đỏ rượu</option>
              <option value="jade">Ngọc</option>
              <option value="none">Không khung</option>
            </Select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Kiểu đường nối tự động</span>
            <Select value={layout.edgeStyle} onChange={(e) => setOpt("edgeStyle", e.target.value as EdgeStyle)}>
              <option value="step">Vuông góc</option>
              <option value="bezier">Đường cong</option>
              <option value="straight">Thẳng</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={layout.autoEdges} onChange={(e) => setOpt("autoEdges", e.target.checked)} />
            Hiện đường nối cha–con, vợ–chồng tự động
          </label>
          <FormActions>
            <Button onClick={() => setTab("idle")}>Xong</Button>
          </FormActions>
        </div>
      </SidePanel>

      <SidePanel
        open={tab === "export"}
        title="Xuất PDF"
        subtitle="Cả phả đồ được co vừa một trang giấy khổ bạn chọn."
        onClose={() => setTab("idle")}
        guard={false}
      >
        <div className="flex flex-1 flex-col space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Khổ giấy</span>
            <Select value={preset} onChange={(e) => setPreset(e.target.value as PaperPreset | "custom")}>
              <option value="A4">A4 (21 × 29,7 cm)</option>
              <option value="A3">A3 (29,7 × 42 cm)</option>
              <option value="A2">A2 (42 × 59,4 cm)</option>
              <option value="A1">A1 (59,4 × 84,1 cm)</option>
              <option value="A0">A0 (84,1 × 118,9 cm)</option>
              <option value="custom">Tuỳ chỉnh (cm)</option>
            </Select>
          </label>
          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Rộng (cm)</span>
                <Input inputMode="decimal" value={customW} onChange={(e) => setCustomW(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Cao (cm)</span>
                <Input inputMode="decimal" value={customH} onChange={(e) => setCustomH(e.target.value)} />
              </label>
            </div>
          ) : (
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Hướng giấy</span>
              <Select value={orient} onChange={(e) => setOrient(e.target.value as typeof orient)}>
                <option value="auto">Tự chọn theo hình dạng cây</option>
                <option value="landscape">Ngang</option>
                <option value="portrait">Dọc</option>
              </Select>
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Lề (cm)</span>
            <Input inputMode="decimal" value={marginCm} onChange={(e) => setMarginCm(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">
            Khổ giấy: {(pageMm.w / 10).toFixed(1)} × {(pageMm.h / 10).toFixed(1)} cm (tối đa 500 cm mỗi cạnh).
          </p>
          <FormActions>
            <Button variant="outline" onClick={() => setTab("idle")}>Huỷ</Button>
            <Button onClick={doExport} disabled={busy || persons.length === 0}>
              {busy ? "Đang xuất…" : "Xuất PDF"}
            </Button>
          </FormActions>
        </div>
      </SidePanel>

      <SidePanel
        open={tab === "save"}
        title="Lưu bố cục"
        subtitle="Bố cục lưu theo dòng họ, mọi thành viên đều xem được."
        onClose={() => setTab("idle")}
        guard={false}
      >
        <div className="flex flex-1 flex-col space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Tên bố cục</span>
            <Input value={saveName} maxLength={80} onChange={(e) => setSaveName(e.target.value)} placeholder="VD: Phả đồ chi trưởng" />
          </label>
          <FormActions>
            {currentId && (
              <Button variant="destructive-outline" onClick={remove} disabled={busy}>Xoá</Button>
            )}
            {currentId && (
              <Button variant="outline" onClick={() => save(true)} disabled={busy}>Lưu bản mới</Button>
            )}
            <Button onClick={() => save(false)} disabled={busy}>Lưu</Button>
          </FormActions>
        </div>
      </SidePanel>
    </div>
  );
}
