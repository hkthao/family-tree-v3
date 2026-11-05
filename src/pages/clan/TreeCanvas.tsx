import { useQuery, useQueryClient } from "@tanstack/react-query";
import type Konva from "konva";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, RegularPolygon, Image as KImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { IconCheck, IconCompass, IconLayoutHorizontal, IconTrash, IconDownload, IconLayers, IconMaximize, IconMinimize, IconPlus, IconRefresh, IconSettings, IconTree, IconUndo, IconUpload } from "@/components/icons";
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
  layoutByLinks,
  buildEdges,
  CANVAS_FONTS,
  contentBounds,
  coverCrop,
  DEFAULT_LAYOUT,
  edgePoints,
  type LinkGeometry,
  dominantSide,
  arrowHead,
  flattenPath,
  LINK_PRESETS,
  zigzagPoints,
  type LinkPreset,
  linkGeometry,
  nearestOnPolylines,
  nearestSide,
  NODE_H,
  NODE_W,
  nodeRect,
  sideAnchor,
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
  type Side,
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

/** 4 chấm nối giữa các cạnh thẻ (hiện khi rê chuột / chọn): kéo từ chấm sang thẻ khác để nối. */
function Handles({ w, h, onStart }: { w: number; h: number; onStart: (side: Side) => void }) {
  return (
    <>
      {(["top", "right", "bottom", "left"] as Side[]).map((side) => {
        const a = sideAnchor({ x: 0, y: 0, w, h }, side);
        const begin = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          onStart(side);
        };
        return (
          <Circle
            key={side}
            x={a.x}
            y={a.y}
            radius={7}
            fill="#fff"
            stroke="#2563EB"
            strokeWidth={2}
            hitStrokeWidth={14}
            onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "crosshair"; }}
            onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ""; }}
            onMouseDown={begin}
            onTouchStart={begin}
          />
        );
      })}
    </>
  );
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
  onDragStart: () => void;
  connecting: boolean;
  onConnectStart: (id: string, side: Side) => void;
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
  const [hover, setHover] = useState(false);
  const showHandles = hover || p.selected || p.connecting;
  const common = {
    nodeId: p.id,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    x: p.x,
    y: p.y,
    draggable: true,
    onDragStart: () => p.onDragStart(),
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
        {showHandles && <Handles w={TEXT_W} h={TEXT_H} onStart={(sd) => p.onConnectStart(p.id, sd)} />}
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
      {showHandles && <Handles w={NODE_W} h={NODE_H} onStart={(sd) => p.onConnectStart(p.id, sd)} />}
    </Group>
  );
});

/** Nút icon có tooltip (title) + nhãn cho trình đọc màn hình. */
function IconBtn({
  label, onClick, disabled, active, primary, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={primary || active ? "default" : "outline"}
      className="h-10 w-10 shrink-0 px-0"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

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
  const [params] = useSearchParams();
  const { canvasId: routeCanvasId } = useParams();
  /** Địa chỉ trang chi tiết của một cây: /tree-canvases/:id (id | "auto"). */
  const goCanvas = useCallback(
    (id: string) => navigate(`/clans/${clan.id}/tree-canvases/${id || "auto"}`, { replace: true }),
    [navigate, clan.id],
  );
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
  // Toàn màn hình kiểu CSS (fixed) thay vì Fullscreen API: dùng được cả iOS Safari,
  // và các ngăn kéo (portal ra body, z-50) vẫn hiện đè lên.
  const [fs, setFs] = useState(false);
  const [canvasName, setCanvasName] = useState("");
  // Đang kéo đường nối từ chấm của một thẻ (kiểu PowerPoint).
  type ConnStart = { node: string; side: Side } | { pt: { x: number; y: number } };
  const [connecting, setConnecting] = useState<{ from: ConnStart } | null>(null);
  const [linkPresetId, setLinkPresetId] = useState<string>("curve");
  const [lineHover, setLineHover] = useState<{ x: number; y: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const justLinkedRef = useRef(false);

  // Lịch sử hoàn tác: ảnh chụp bố cục trước mỗi thay đổi. Thay đổi liên tiếp cùng
  // `key` trong 1 giây (gõ chữ, kéo thanh trượt) gộp thành một bước.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const pastRef = useRef<CanvasLayout[]>([]);
  const futureRef = useRef<CanvasLayout[]>([]);
  const lastKeyRef = useRef({ k: "", t: 0 });
  const pushHistory = useCallback((key?: string) => {
    const now = Date.now();
    if (key && lastKeyRef.current.k === key && now - lastKeyRef.current.t < 1000) {
      lastKeyRef.current.t = now;
      return;
    }
    lastKeyRef.current = { k: key ?? "", t: now };
    pastRef.current.push(layoutRef.current);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
  }, []);
  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    lastKeyRef.current = { k: "", t: 0 };
  }, []);
  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(layoutRef.current);
    lastKeyRef.current = { k: "", t: 0 };
    setLayout(prev);
    setDirty(true);
    setSel(null);
  }, []);
  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(layoutRef.current);
    lastKeyRef.current = { k: "", t: 0 };
    setLayout(next);
    setDirty(true);
    setSel(null);
  }, []);

  /** Mọi thay đổi bố cục đi qua đây để đánh dấu "chưa lưu" và ghi lịch sử. */
  const update = useCallback(
    (fn: (l: CanvasLayout) => CanvasLayout, key?: string) => {
      pushHistory(key);
      setLayout(fn);
      setDirty(true);
    },
    [pushHistory],
  );

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !canvases) return;
    initRef.current = true;
    const want = routeCanvasId ?? params.get("c");
    const target = want === "auto" ? undefined : (canvases.find((c) => c.id === want) ?? canvases[0]);
    if (target) {
      clearHistory();
      setCanvasName(target.name);
      setCurrentId(target.id);
      setLayout(target.layout);
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

  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    if (fs) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => fitRef.current(), 150);
      return () => {
        document.body.style.overflow = prev;
        clearTimeout(t);
        setTimeout(() => fitRef.current(), 150);
      };
    }
  }, [fs]);

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

  const rectOf = useCallback(
    (id: string) => {
      const pos = positions[id];
      return pos ? nodeRect(pos, extraById.get(id)) : null;
    },
    [positions, extraById],
  );
  /** Thẻ nằm dưới điểm `pt` (canvas) — thẻ vẽ sau nằm trên. */
  const nodeAt = (pt: { x: number; y: number }, except?: string): string | null => {
    const ids = Object.keys(positions).reverse();
    for (const id of ids) {
      if (id === except) continue;
      const r = rectOf(id);
      if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return id;
    }
    return null;
  };
  const stagePoint = () => {
    const st = stageRef.current;
    const p = st?.getRelativePointerPosition();
    return p ? { x: p.x, y: p.y } : null;
  };

  // Các đường đang vẽ (tự động + tuỳ chỉnh) dạng đa tuyến — để bắt dính và rê chuột tìm điểm nối.
  const autoLines = useMemo(() => {
    const out: Array<{ g: LinkGeometry; kind: "spouse" | "parent" }> = [];
    if (!layout.autoEdges) return out;
    for (const e of edges) {
      const a = positions[e.from];
      const b = positions[e.to];
      if (!a || !b) continue;
      if (e.kind === "spouse") {
        const [l, r] = a.x <= b.x ? [a, b] : [b, a];
        const p1 = anchor(l, "right");
        const p2 = anchor(r, "left");
        out.push({ g: { points: [p1.x, p1.y, p2.x, p2.y], bezier: false, tension: 0 }, kind: "spouse" });
        continue;
      }
      const sp = spouseOf.get(e.from);
      const spPos = sp ? positions[sp] : undefined;
      let from = anchor(a, "bottom");
      if (spPos && Math.abs(spPos.y - a.y) < 1) {
        const o = anchor(spPos, "bottom");
        from = { x: (from.x + o.x) / 2, y: from.y };
      }
      const { points, bezier } = edgePoints(layout.edgeStyle, from, anchor(b, "top"));
      out.push({ g: { points, bezier, tension: 0 }, kind: "parent" });
    }
    return out;
  }, [edges, positions, spouseOf, layout.autoEdges, layout.edgeStyle]);

  /** Giải đầu/cuối và hình học của một đường nối tuỳ chỉnh; null nếu thẻ đầu/cuối không còn. */
  const linkEnds = useCallback(
    (k: CustomLink) => {
      const ra = k.from ? rectOf(k.from) : null;
      const rb = k.to ? rectOf(k.to) : null;
      if ((k.from && !ra) || (k.to && !rb)) return null;
      const ca = ra ? { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 } : k.fromPt;
      const cb = rb ? { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 } : k.toPt;
      if (!ca || !cb) return null;
      const via = k.points ?? [];
      const as = ra ? (k.fromSide ?? dominantSide(ca, via[0] ?? cb)) : undefined;
      const bs = rb ? (k.toSide ?? dominantSide(cb, via[via.length - 1] ?? ca)) : undefined;
      const a = ra && as ? sideAnchor(ra, as) : (k.fromPt as { x: number; y: number });
      const b = rb && bs ? sideAnchor(rb, bs) : (k.toPt as { x: number; y: number });
      return { a, b, g: linkGeometry(k.style, a, as, b, bs, via) };
    },
    [rectOf],
  );

  const allPolys = useMemo(
    () => [
      ...autoLines.map((l) => flattenPath(l.g)),
      ...layout.links.map((k) => linkEnds(k)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => flattenPath(x.g)),
    ],
    [autoLines, layout.links, linkEnds],
  );
  const spouseMids = useMemo(
    () =>
      autoLines
        .filter((l) => l.kind === "spouse")
        .map((l) => ({ x: (l.g.points[0] + l.g.points[2]) / 2, y: (l.g.points[1] + l.g.points[3]) / 2 })),
    [autoLines],
  );
  /** Bắt dính điểm vào trung điểm đường vợ–chồng, hoặc điểm gần nhất trên một đường (≤14px màn hình). */
  const snapPoint = (pt: { x: number; y: number }, maxPx = 14) => {
    const tol = maxPx / view.scale;
    let best: { x: number; y: number } | null = null;
    let bd = tol;
    for (const m of spouseMids) {
      const d = Math.hypot(m.x - pt.x, m.y - pt.y);
      if (d <= bd) { best = m; bd = d; }
    }
    if (best) return best;
    const n = nearestOnPolylines(allPolys, pt, tol);
    return n ? { x: n.x, y: n.y } : null;
  };

  const lastHoverRef = useRef(0);
  const trackPointer = () => {
    const pt = stagePoint();
    if (connecting) return setPointer(pt);
    const now = Date.now();
    if (now - lastHoverRef.current < 40) return;
    lastHoverRef.current = now;
    if (!pt || nodeAt(pt)) return setLineHover((h) => (h ? null : h));
    const n = snapPoint(pt, 10);
    setLineHover(n);
  };
  const connFromId = connecting && "node" in connecting.from ? connecting.from.node : undefined;
  const connStartPt = (): { x: number; y: number } | null => {
    if (!connecting) return null;
    if ("pt" in connecting.from) return connecting.from.pt;
    const r = rectOf(connecting.from.node);
    return r ? sideAnchor(r, connecting.from.side) : null;
  };
  const finishConnect = () => {
    if (!connecting) return;
    const pt = stagePoint() ?? pointer;
    const start = connStartPt();
    const target = pt ? nodeAt(pt, connFromId) : null;
    const pre = LINK_PRESETS.find((x) => x.id === linkPresetId) ?? LINK_PRESETS[4];
    const base = { id: newId("l"), color: "#8B1E2D", width: 3, dash: pre.dash, style: pre.style, arrow: pre.arrow };
    const f = connecting.from;
    const fromPart = "node" in f ? { from: f.node, fromSide: f.side } : { from: "", fromPt: f.pt };
    let lk: CustomLink | null = null;
    if (pt && target) {
      lk = { ...base, ...fromPart, to: target, toSide: nearestSide(rectOf(target)!, pt) };
    } else if (pt && start && Math.hypot(pt.x - start.x, pt.y - start.y) > 12 / view.scale) {
      lk = { ...base, ...fromPart, to: "", toPt: snapPoint(pt) ?? pt };
    }
    if (lk && pre.zigzag && start) {
      const endPt = target && pt ? sideAnchor(rectOf(target)!, lk.toSide ?? "top") : (lk.toPt as { x: number; y: number });
      lk = { ...lk, points: zigzagPoints(start, endPt) };
    }
    if (lk) {
      const made = lk;
      update((l) => ({ ...l, links: [...l.links, made] }));
      justLinkedRef.current = true;
      setSel({ kind: "link", id: made.id });
    }
    setConnecting(null);
    setPointer(null);
  };
  useEffect(() => {
    if (!connecting) return;
    const cancel = () => { setConnecting(null); setPointer(null); };
    const t = setTimeout(() => window.addEventListener("mouseup", cancel, { once: true }), 0);
    return () => { clearTimeout(t); window.removeEventListener("mouseup", cancel); };
  }, [connecting]);

  // Sửa đầu / điểm uốn của đường nối đang chọn.
  const moveEnd = (id: string, which: "from" | "to", pt: { x: number; y: number }) => {
    const target = nodeAt(pt);
    update((l) => ({
      ...l,
      links: l.links.map((k) => {
        if (k.id !== id) return k;
        const next: CustomLink = { ...k };
        if (target && target !== (which === "from" ? k.to : k.from)) {
          const side = nearestSide(rectOf(target)!, pt);
          if (which === "from") { next.from = target; next.fromSide = side; next.fromPt = undefined; }
          else { next.to = target; next.toSide = side; next.toPt = undefined; }
        } else {
          const q = snapPoint(pt) ?? pt;
          if (which === "from") { next.from = ""; next.fromSide = undefined; next.fromPt = q; }
          else { next.to = ""; next.toSide = undefined; next.toPt = q; }
        }
        return next;
      }),
    }));
  };
  const setWaypoint = (id: string, i: number, pt: { x: number; y: number }) =>
    setLayout((l) => ({
      ...l,
      links: l.links.map((k) => (k.id === id ? { ...k, points: (k.points ?? []).map((q, j) => (j === i ? pt : q)) } : k)),
    }));
  const insertWaypoint = (id: string, at: number, pt: { x: number; y: number }) =>
    update((l) => ({
      ...l,
      links: l.links.map((k) => {
        if (k.id !== id) return k;
        const pts = [...(k.points ?? [])];
        pts.splice(at, 0, pt);
        return { ...k, points: pts };
      }),
    }));
  const removeWaypoint = (id: string, i: number) =>
    update((l) => ({
      ...l,
      links: l.links.map((k) => (k.id === id ? { ...k, points: (k.points ?? []).filter((_, j) => j !== i) } : k)),
    }));

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
    update((l) => ({ ...l, nodeStyles: { ...l.nodeStyles, [id]: { ...l.nodeStyles[id], ...patch } } }), `node:${id}:${Object.keys(patch).join()}`);

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
    update((l) => ({ ...l, links: l.links.map((k) => (k.id === id ? { ...k, ...patch } : k)) }), `link:${id}:${Object.keys(patch).join()}`);
  const removeLink = (id: string) => {
    update((l) => ({ ...l, links: l.links.filter((k) => k.id !== id) }));
    setSel(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") { setFs(false); setLinkMode(false); setLinkFrom(null); setSel(null); }
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
    pushHistory();
    setLayout(DEFAULT_LAYOUT);
    setSel(null);
    setDirty(true);
    fitted.current = false;
    setTimeout(fit, 0);
  }
  // Xếp lại: thành viên đang hiện xếp theo đời (bỏ người đã ẩn để không chừa khoảng trống);
  // thẻ trống / ô chữ thêm tay xếp thành lưới ngay dưới cây (hoặc từ đầu nếu canvas trống).
  const autoArrange = () => {
    const tree = autoLayout(visiblePersons, families);
    let bottom = 0;
    let any = false;
    for (const p of Object.values(tree)) {
      bottom = Math.max(bottom, p.y + NODE_H);
      any = true;
    }
    const placed: CanvasLayout["positions"] = {};
    const sizes: Record<string, { w: number; h: number }> = {};
    for (const e of layout.extras) {
      const r = nodeRect({ x: 0, y: 0 }, e);
      sizes[e.id] = { w: r.w, h: r.h };
    }
    const startY = any ? bottom + 90 : 0;
    const { positions: byLink, loose } = layoutByLinks(sizes, layout.links);
    let linkedBottom = startY;
    for (const [id, p] of Object.entries(byLink)) {
      placed[id] = { x: p.x, y: startY + p.y };
      linkedBottom = Math.max(linkedBottom, startY + p.y + sizes[id].h);
    }
    const perRow = 6;
    let x = 0;
    let row = 0;
    let rowH = 0;
    const looseY = Object.keys(byLink).length ? linkedBottom + 90 : startY;
    loose.forEach((id, n) => {
      if (n > 0 && n % perRow === 0) { x = 0; row += rowH + 40; rowH = 0; }
      placed[id] = { x, y: looseY + row };
      x += sizes[id].w + 40;
      rowH = Math.max(rowH, sizes[id].h);
    });
    update((l) => ({ ...l, positions: { ...tree, ...placed } }));
    setTimeout(() => fitRef.current(), 0);
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
  async function save(asNew: boolean, nameArg: string = saveName) {
    const name = nameArg.trim();
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
        goCanvas(c.id);
      }
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      setCanvasName(name);
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
      clearHistory();
      setCanvasName("");
      setCurrentId("");
      goCanvas("auto");
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

  /** Chọn kiểu dựng sẵn: dùng cho đường nối mới, và đổi luôn kiểu của đường đang chọn. */
  const pickPreset = (pre: LinkPreset) => {
    setLinkPresetId(pre.id);
    const k = sel?.kind === "link" ? layout.links.find((x) => x.id === sel.id) : undefined;
    if (!k) return;
    const ends = linkEnds(k);
    update((l) => ({
      ...l,
      links: l.links.map((x) =>
        x.id !== k.id
          ? x
          : {
              ...x,
              style: pre.style,
              dash: pre.dash,
              arrow: pre.arrow,
              points: pre.zigzag && ends ? zigzagPoints(ends.a, ends.b) : undefined,
            },
      ),
    }));
  };

  useEffect(() => {
    if (justLinkedRef.current) { justLinkedRef.current = false; return; }
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
      linkPreset={linkPresetId}
      onPickPreset={pickPreset}
      selection={inspector}
    />
  );

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Dòng họ", to: "/clans" },
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Canvas phả đồ", to: `/clans/${clan.id}/tree-canvases` },
          { label: canvasName.trim() || "Cây tự xếp" },
        ]}
      />
      <PageHeader
        icon={<IconTree className="h-6 w-6" />}
        title="Canvas phả đồ"
        description="Kéo thả thẻ thiết kế sẵn, nối đường, sửa chữ, chọn nền rồi xuất PDF khổ tuỳ ý."
      />

      <div className={fs ? "fixed inset-0 z-40 flex flex-col gap-3 overflow-hidden bg-background p-3" : "space-y-3"}>
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto">
        <IconBtn label={showPalette ? "Đóng công cụ thiết kế" : "Công cụ thiết kế"} active={showPalette} onClick={() => setShowPalette((v) => !v)}>
          <IconLayers className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Tự xếp lại theo đời" onClick={autoArrange}>
          <IconRefresh className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Căn chỉnh: dồn thẻ cùng hàng, bám lưới" onClick={alignTidy}>
          <IconLayoutHorizontal className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Đặt lại về ban đầu" onClick={doReset}>
          <IconTrash className="h-4 w-4" />
        </IconBtn>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <IconBtn label="Hoàn tác (Ctrl+Z)" onClick={undo} disabled={pastRef.current.length === 0}>
            <IconUndo className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Làm lại (Ctrl+Shift+Z)" onClick={redo} disabled={futureRef.current.length === 0}>
            <IconUndo className="h-4 w-4 -scale-x-100" />
          </IconBtn>
          <IconBtn label="Thu nhỏ" onClick={() => zoomBy(1 / 1.2)}>
            <span className="text-lg leading-none">−</span>
          </IconBtn>
          <IconBtn label="Phóng to" onClick={() => zoomBy(1.2)}>
            <IconPlus className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Vừa khung" onClick={fit}>
            <IconCompass className="h-4 w-4" />
          </IconBtn>
          <IconBtn label={fs ? "Thoát toàn màn hình (Esc)" : "Toàn màn hình"} onClick={() => setFs((v) => !v)}>
            {fs ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
          </IconBtn>
          <IconBtn label="Tuỳ chọn" onClick={() => setTab("options")}>
            <IconSettings className="h-4 w-4" />
          </IconBtn>
          {canEdit && (
            <IconBtn label={dirty ? "Lưu bố cục (có thay đổi chưa lưu)" : "Lưu bố cục"} primary onClick={() => {
              if (currentId && canvasName.trim()) return void save(false, canvasName);
              setSaveName(canvasName);
              setTab("save");
            }}>
              <span className="relative">
                <IconCheck className="h-4 w-4" />
                {dirty && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-amber-300" />}
              </span>
            </IconBtn>
          )}
          <IconBtn label="Xuất PDF" primary onClick={() => setTab("export")}>
            <IconDownload className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>

      <div className={fs ? "relative min-h-0 flex-1" : "relative"}>
        <aside
          className={`absolute ${fs ? "bottom-2" : "bottom-16"} right-2 top-2 z-10 w-[min(24rem,calc(100%-1rem))] overflow-y-auto overflow-x-hidden rounded-xl border bg-card p-3 shadow-xl transition-transform duration-200 ${showPalette ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+1rem)]"}`}
          aria-hidden={!showPalette}
          data-testid="canvas-palette"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Công cụ thiết kế</span>
            <button type="button" className="rounded-md px-2 py-1 text-sm hover:bg-secondary" onClick={() => setShowPalette(false)} aria-label="Đóng công cụ">✕</button>
          </div>
          {palette}
        </aside>

        <div className={fs ? "flex h-full flex-col" : ""}>
          <div
            ref={wrapRef}
            className={`relative overflow-hidden rounded-xl border ${fs ? "min-h-0 flex-1" : "h-[calc(100dvh-13rem)] min-h-[480px]"}`}
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
              onMouseMove={trackPointer}
              onTouchMove={trackPointer}
              onMouseLeave={() => setLineHover(null)}
              onMouseUp={finishConnect}
              onTouchEnd={finishConnect}
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
                {autoLines.map((l, i) => (
                  <Line key={i} points={l.g.points} bezier={l.g.bezier} stroke={bg.edge}
                    strokeWidth={l.kind === "spouse" ? 3 : 2} lineJoin="round" lineCap="round" />
                ))}
              </Layer>
              <Layer>
                {layout.links.map((k) => {
                  const ends = linkEnds(k);
                  if (!ends) return null;
                  const on = sel?.kind === "link" && sel.id === k.id;
                  const poly = k.arrow && k.arrow !== "none" ? flattenPath(ends.g) : null;
                  const r = 6 + k.width * 1.6;
                  const heads = poly
                    ? [arrowHead(poly, true, r), k.arrow === "both" ? arrowHead(poly, false, r) : null]
                    : [];
                  return (
                    <Fragment key={k.id}>
                      {heads.map((h, i) =>
                        h ? (
                          <RegularPolygon key={i} x={h.x} y={h.y} sides={3} radius={r} rotation={h.rotation}
                            fill={k.color} listening={false} />
                        ) : null,
                      )}
                    <Line
                      points={ends.g.points}
                      bezier={ends.g.bezier}
                      tension={ends.g.tension}
                      stroke={k.color}
                      strokeWidth={on ? k.width + 2 : k.width}
                      dash={k.dash ? [k.width * 3, k.width * 2] : undefined}
                      lineJoin="round"
                      lineCap="round"
                      hitStrokeWidth={16}
                      onClick={() => setSel({ kind: "link", id: k.id })}
                      onTap={() => setSel({ kind: "link", id: k.id })}
                    />
                    </Fragment>
                  );
                })}
                {connecting && pointer && (() => {
                  const a = connStartPt();
                  if (!a) return null;
                  const snap = snapPoint(pointer);
                  const end = nodeAt(pointer, connFromId) ? pointer : (snap ?? pointer);
                  return (
                    <>
                      <Line points={[a.x, a.y, end.x, end.y]} stroke="#2563EB" strokeWidth={2.5} dash={[8, 6]} listening={false} />
                      {snap && !nodeAt(pointer, connFromId) && <Circle x={snap.x} y={snap.y} radius={6} fill="#2563EB" listening={false} />}
                    </>
                  );
                })()}
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
                      picked={linkFrom === id || (!!connecting && !!pointer && nodeAt(pointer, connFromId) === id)}
                      onMove={onMove}
                      onDragStart={() => pushHistory()}
                      connecting={!!connecting}
                      onConnectStart={(id, side) => { setConnecting({ from: { node: id, side } }); setPointer(null); setLineHover(null); }}
                      onOpen={onOpen}
                      onSelect={onSelect}
                    />
                  );
                })}
                {/* Chấm kéo của đường nối đang chọn: đầu (xanh), điểm uốn (vuông), thêm điểm (nhỏ) */}
                {sel?.kind === "link" && !connecting && (() => {
                  const k = layout.links.find((x) => x.id === sel.id);
                  const ends = k ? linkEnds(k) : null;
                  if (!k || !ends) return null;
                  const chain = [ends.a, ...(k.points ?? []), ends.b];
                  const endHandle = (which: "from" | "to", pt: { x: number; y: number }) => (
                    <Circle
                      key={which}
                      x={pt.x}
                      y={pt.y}
                      radius={8}
                      fill="#2563EB"
                      stroke="#fff"
                      strokeWidth={2}
                      draggable
                      onDragStart={() => pushHistory()}
                      onDragEnd={() => { const q = stagePoint(); if (q) moveEnd(k.id, which, q); }}
                      onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "grab"; }}
                      onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ""; }}
                    />
                  );
                  return (
                    <>
                      {chain.slice(0, -1).map((p, i) => {
                        const q = chain[i + 1];
                        return (
                          <Circle
                            key={`m${i}`}
                            x={(p.x + q.x) / 2}
                            y={(p.y + q.y) / 2}
                            radius={5}
                            fill="#fff"
                            stroke="#2563EB"
                            strokeWidth={1.5}
                            opacity={0.85}
                            onClick={() => insertWaypoint(k.id, i, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })}
                            onTap={() => insertWaypoint(k.id, i, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })}
                            onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "copy"; }}
                            onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ""; }}
                          />
                        );
                      })}
                      {(k.points ?? []).map((p, i) => (
                        <Rect
                          key={`w${i}`}
                          x={p.x}
                          y={p.y}
                          width={12}
                          height={12}
                          offsetX={6}
                          offsetY={6}
                          fill="#fff"
                          stroke="#2563EB"
                          strokeWidth={2}
                          draggable
                          onDragStart={() => pushHistory()}
                          onDragMove={(e) => setWaypoint(k.id, i, { x: e.target.x(), y: e.target.y() })}
                          onDblClick={() => removeWaypoint(k.id, i)}
                          onDblTap={() => removeWaypoint(k.id, i)}
                          onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "move"; }}
                          onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ""; }}
                        />
                      ))}
                      {endHandle("from", ends.a)}
                      {endHandle("to", ends.b)}
                    </>
                  );
                })()}
                {/* Chấm nối tự do trên một đường: kéo từ đây để nối từ giữa đường (vd. giữa hai vợ chồng) */}
                {lineHover && !connecting && (
                  <Circle
                    x={lineHover.x}
                    y={lineHover.y}
                    radius={6}
                    fill="#fff"
                    stroke="#2563EB"
                    strokeWidth={2}
                    hitStrokeWidth={12}
                    onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "crosshair"; }}
                    onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ""; }}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      setConnecting({ from: { pt: { x: lineHover.x, y: lineHover.y } } });
                      setPointer(null);
                      setLineHover(null);
                    }}
                    onTouchStart={(e) => {
                      e.cancelBubble = true;
                      setConnecting({ from: { pt: { x: lineHover.x, y: lineHover.y } } });
                      setPointer(null);
                      setLineHover(null);
                    }}
                  />
                )}
              </Layer>
            </Stage>
          </div>
          <p className={`mt-2 text-xs text-muted-foreground ${fs ? "hidden" : ""}`}>
            Kéo thẻ để đổi vị trí · kéo nền để di chuyển · cuộn để thu phóng · nhấp thẻ để sửa ở bảng trái · nhấp đúp để mở hồ sơ · Delete để xoá mục đang chọn.
            {!canEdit && " Bạn chỉ có quyền xem: kéo thử và xuất PDF được nhưng không lưu."}
          </p>
        </div>
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
          {canEdit && currentId && (
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Tên cây</span>
              <Input value={canvasName} maxLength={80} onChange={(e) => { setCanvasName(e.target.value); setDirty(true); }} />
            </label>
          )}
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
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-secondary">
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
            <Button onClick={() => save(false)} disabled={busy}>Lưu</Button>
          </FormActions>
        </div>
      </SidePanel>
    </div>
  );
}
