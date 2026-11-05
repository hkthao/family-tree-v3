import { useQuery, useQueryClient } from "@tanstack/react-query";
import type Konva from "konva";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import { useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { IconDownload, IconMaximize, IconPlus, IconRefresh, IconTree } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
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
  contentBounds,
  DEFAULT_LAYOUT,
  edgePoints,
  NODE_H,
  NODE_W,
  paperSizeMm,
  type CanvasBackground,
  type CanvasLayout,
  type EdgeStyle,
  type NodeFrame,
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

interface NodeProps {
  person: PersonForTree;
  x: number;
  y: number;
  photoUrl: string | null;
  frame: NodeFrame;
  draggable: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onOpen: (id: string) => void;
}

const PersonNode = memo(function PersonNode({
  person, x, y, photoUrl, frame, draggable, onMove, onOpen,
}: NodeProps) {
  const fallback = person.gender === "M" ? "/avatars/male-royal.svg" : "/avatars/female-royal.svg";
  const img = useImage(photoUrl);
  const fb = useImage(fallback);
  const shown = img ?? fb;
  const col = FRAME_COLOR[frame];
  const R = 46;
  const cx = NODE_W / 2;
  const cy = 62;
  return (
    <Group
      x={x}
      y={y}
      draggable={draggable}
      onDragMove={(e) => onMove(person.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => onMove(person.id, e.target.x(), e.target.y())}
      onDblClick={() => onOpen(person.id)}
      onDblTap={() => onOpen(person.id)}
    >
      {/* Thẻ: nền + viền kép (hoa văn khung) */}
      <Rect
        width={NODE_W} height={NODE_H} cornerRadius={14}
        fill={col.fill} stroke={col.stroke} strokeWidth={frame === "none" ? 1 : 3}
        shadowColor="#000" shadowBlur={8} shadowOpacity={0.18} shadowOffsetY={2}
      />
      {frame !== "none" && (
        <Rect x={6} y={6} width={NODE_W - 12} height={NODE_H - 12} cornerRadius={10}
          stroke={col.inner} strokeWidth={1} dash={[4, 3]} listening={false} />
      )}
      {frame !== "none" && [[10, 10], [NODE_W - 10, 10], [10, NODE_H - 10], [NODE_W - 10, NODE_H - 10]].map(([px, py], i) => (
        <Rect key={i} x={px} y={py} width={7} height={7} offsetX={3.5} offsetY={3.5} rotation={45}
          fill={col.stroke} listening={false} />
      ))}
      {/* Ảnh tròn */}
      <Group
        clipFunc={(ctx) => { ctx.arc(cx, cy, R, 0, Math.PI * 2); }}
        listening={false}
      >
        <Rect x={cx - R} y={cy - R} width={R * 2} height={R * 2} fill="#E7DFD1" />
        {shown && (() => {
          // object-cover: lấp đầy vòng, canh trên (ảnh chân dung thường đầu ở trên).
          const iw = shown.naturalWidth || shown.width || 1;
          const ih = shown.naturalHeight || shown.height || 1;
          const s = Math.max((R * 2) / iw, (R * 2) / ih);
          return (
            <KImage image={shown} x={cx - (iw * s) / 2} y={cy - R} width={iw * s} height={ih * s} />
          );
        })()}
      </Group>
      <Circle x={cx} y={cy} radius={R} stroke={col.stroke} strokeWidth={2} listening={false} />
      {person.generation != null && (
        <Group x={20} y={20} listening={false}>
          <Circle radius={11} fill={col.stroke} />
          <Text text={String(person.generation)} x={-11} y={-6} width={22} align="center"
            fontSize={11} fontStyle="bold" fill="#fff" fontFamily={FONT} />
        </Group>
      )}
      <Text text={person.full_name} x={8} y={118} width={NODE_W - 16} height={44}
        align="center" verticalAlign="top" fontSize={14} fontStyle="bold" lineHeight={1.2}
        ellipsis fill="#2A211B" fontFamily={FONT} listening={false} />
      <Text text={yearsOf(person)} x={8} y={NODE_H - 28} width={NODE_W - 16} align="center"
        fontSize={11} fill={person.is_living ? "#5E6B4F" : "#7A6B5A"} fontFamily={FONT} listening={false} />
    </Group>
  );
});

type Tab = "idle" | "export" | "save";

export default function TreeCanvas() {
  const { clan } = useClanContext();
  const canEdit = canEditClan(clan);
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const toast = useToast();
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

  // Cài bố cục lần đầu: canvas mới nhất đã lưu, hoặc tự xếp.
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
  const auto = useMemo(() => autoLayout(persons, families), [persons, families]);
  const positions = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = { ...auto };
    for (const [id, p] of Object.entries(layout.positions)) if (out[id]) out[id] = p;
    return out;
  }, [auto, layout.positions]);

  const edges = useMemo(() => buildEdges(persons, families), [persons, families]);
  const spouseOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of families) {
      if (f.husband_id && f.wife_id) { m.set(f.husband_id, f.wife_id); m.set(f.wife_id, f.husband_id); }
    }
    return m;
  }, [families]);

  // ─── khung nhìn: kích thước, zoom, kéo nền ───
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
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

  const onMove = useCallback((id: string, x: number, y: number) => {
    setLayout((l) => ({ ...l, positions: { ...l.positions, [id]: { x, y } } }));
    setDirty(true);
  }, []);
  const onOpen = useCallback(
    (id: string) => navigate(`/clans/${clan.id}/people/${id}`),
    [navigate, clan.id],
  );

  const setOpt = <K extends "edgeStyle" | "background" | "frame">(k: K, v: CanvasLayout[K]) => {
    setLayout((l) => ({ ...l, [k]: v }));
    setDirty(true);
  };

  const bg = BG_STYLE[layout.background];
  const tile = useMemo(() => makeTile(layout.background), [layout.background]);

  // ─── lưu ───
  const currentCanvas = canvases?.find((c) => c.id === currentId);
  async function save(asNew: boolean) {
    const name = saveName.trim();
    if (!name) return toast.error("Hãy đặt tên cho bố cục");
    setBusy(true);
    try {
      // Chỉ lưu vị trí của người còn trong cây (người đã xoá thì bỏ).
      const pos: CanvasLayout["positions"] = {};
      for (const p of persons) pos[p.id] = positions[p.id];
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
    try {
      await document.fonts?.load(`700 14px ${FONT}`, "Nguyễn Đặng ữỗọệ").catch(() => undefined);
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
            stage.draw();
            return stage.toDataURL({ mimeType: "image/jpeg", quality: 0.92, pixelRatio: ratio });
          } finally {
            stage.size({ width: prev.w, height: prev.h });
            stage.scale({ x: prev.sx, y: prev.sx });
            stage.position({ x: prev.x, y: prev.y });
            stage.draw();
          }
        },
      });
      setTab("idle");
      toast.success(`Đã xuất ${res.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xuất được PDF");
    } finally {
      setBusy(false);
    }
  }

  const bgRectSize = 200000;

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
        description="Kéo thả thẻ để sắp xếp cây theo ý, chọn kiểu đường nối và nền, rồi xuất PDF khổ tuỳ ý."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Bố cục đã lưu"
          className="h-10 w-auto min-w-[10rem] text-sm"
          value={currentId}
          onChange={(e) => {
            const c = canvases?.find((x) => x.id === e.target.value);
            setCurrentId(e.target.value);
            setLayout(c ? c.layout : DEFAULT_LAYOUT);
            setDirty(false);
          }}
        >
          <option value="">Bố cục tự xếp (chưa lưu)</option>
          {canvases?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Kiểu đường nối" className="h-10 w-auto text-sm" value={layout.edgeStyle}
          onChange={(e) => setOpt("edgeStyle", e.target.value as EdgeStyle)}>
          <option value="step">Nối vuông góc</option>
          <option value="bezier">Nối đường cong</option>
          <option value="straight">Nối thẳng</option>
        </Select>
        <Select aria-label="Nền" className="h-10 w-auto text-sm" value={layout.background}
          onChange={(e) => setOpt("background", e.target.value as CanvasBackground)}>
          <option value="paper">Nền giấy kẻ</option>
          <option value="lattice">Nền hoa văn trám</option>
          <option value="plain">Nền trắng</option>
          <option value="dark">Nền tối</option>
        </Select>
        <Select aria-label="Khung thẻ" className="h-10 w-auto text-sm" value={layout.frame}
          onChange={(e) => setOpt("frame", e.target.value as NodeFrame)}>
          <option value="gold">Khung vàng</option>
          <option value="wine">Khung đỏ rượu</option>
          <option value="jade">Khung ngọc</option>
          <option value="none">Không khung</option>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => zoomBy(1 / 1.2)} aria-label="Thu nhỏ">−</Button>
          <Button size="sm" variant="outline" onClick={() => zoomBy(1.2)} aria-label="Phóng to">
            <IconPlus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={fit}>
            <IconMaximize className="h-4 w-4" /> Vừa khung
          </Button>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => { setLayout((l) => ({ ...l, positions: {} })); setDirty(true); }}>
              <IconRefresh className="h-4 w-4" /> Tự xếp lại
            </Button>
          )}
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

      <div
        ref={wrapRef}
        className="relative h-[calc(100dvh-20rem)] min-h-[360px] overflow-hidden rounded-xl border"
        style={{ background: bg.base, touchAction: "none" }}
        data-testid="tree-canvas"
      >
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Đang tải…</p>}
        {!isLoading && persons.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Chưa có ai trong gia phả để vẽ.</p>
        )}
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onWheel={(e) => {
            e.evt.preventDefault();
            const p = e.target.getStage()?.getPointerPosition();
            zoomBy(e.evt.deltaY > 0 ? 1 / 1.1 : 1.1, p?.x, p?.y);
          }}
        >
          <Layer listening={false}>
            <Rect
              x={-bgRectSize / 2} y={-bgRectSize / 2} width={bgRectSize} height={bgRectSize}
              fill={bg.base}
              fillPatternImage={tile ? (tile as unknown as HTMLImageElement) : undefined}
              fillPatternRepeat="repeat"
            />
          </Layer>
          <Layer listening={false}>
            {edges.map((e, i) => {
              const a = positions[e.from];
              const b = positions[e.to];
              if (!a || !b) return null;
              if (e.kind === "spouse") {
                const [l, r] = a.x <= b.x ? [a, b] : [b, a];
                const p1 = anchor(l, "right");
                const p2 = anchor(r, "left");
                return <Line key={i} points={[p1.x, p1.y, p2.x, p2.y]} stroke={bg.edge} strokeWidth={3} />;
              }
              // Cha/mẹ có vợ/chồng: đường đi từ điểm giữa cặp, không từ riêng một người.
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
            {persons.map((p) => {
              const pos = positions[p.id];
              if (!pos) return null;
              return (
                <PersonNode
                  key={p.id}
                  person={p}
                  x={pos.x}
                  y={pos.y}
                  photoUrl={p.photo_path ? (photoUrls?.get(p.photo_path) ?? null) : null}
                  frame={layout.frame}
                  draggable
                  onMove={onMove}
                  onOpen={onOpen}
                />
              );
            })}
          </Layer>
        </Stage>
      </div>
      <p className="text-xs text-muted-foreground">
        Kéo thẻ để đổi vị trí · kéo nền để di chuyển · cuộn chuột để phóng to/thu nhỏ · nhấp đúp vào thẻ để mở hồ sơ.
        {!canEdit && " Bạn chỉ có quyền xem: có thể kéo thử và xuất PDF nhưng không lưu được."}
      </p>

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
