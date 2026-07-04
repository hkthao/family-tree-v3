import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconMaximize, IconMinimize } from "@/components/icons";
import type { ForceGraph3DInstance, NodeObject } from "3d-force-graph";
import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace } from "three";
import SpriteText from "three-spritetext";

import { displayGen } from "@/lib/displayGeneration";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { getTreeData, type TreeData } from "@/lib/queries/tree";
import { subscribeTheme } from "@/lib/theme";

type GraphInstance = ForceGraph3DInstance;

type GLink = { source: string; target: string };
type GNode = NodeObject & {
  name: string;
  gender: "M" | "F";
  isRoot: boolean;
  years: string;
  gen: number | null;
  color: string;
  img: string;
  avatar: string;
  childCount: number; // số con trực tiếp (badge + biết có mở rộng được không)
  childLinks?: GLink[]; // gán khi ở chế độ mở rộng dần
  collapsed?: boolean; // đang thu gọn nhánh con?
};

type Palette = ReturnType<typeof palette>;

/** Bảng màu bám theo theme sáng/tối của app (khớp token trong index.css). */
function palette(dark: boolean) {
  return dark
    ? {
        bg: "#1A1612", // --background
        card: "#221E19", // --card (lifted)
        cardName: "#EFE9DB", // --foreground (cream)
        cardYears: "#BAB1A3", // --muted-foreground
        photoBg: "#2B2520", // --muted
        link: "#5C5349",
        linkText: "#9C9082",
        root: "#D4A045", // --accent (bronze, dark)
        male: "#6FA0C8",
        female: "#D08A91",
        particle: "#D4A045",
      }
    : {
        bg: "#FBF7F0", // --background (paper)
        card: "#FFFFFF",
        cardName: "#2A2320", // --foreground (ink)
        cardYears: "#7A6F66", // --muted-foreground
        photoBg: "#ECE6DA",
        link: "#CBBFAC",
        linkText: "#8A7F72",
        root: "#B8862A", // --accent (bronze, light)
        male: "#5B8FB8",
        female: "#C97F86",
        particle: "#B8862A",
      };
}

function isDarkNow() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

const avatarOf = (g: "M" | "F") =>
  g === "M" ? "/avatars/male.png" : "/avatars/female.png";

/** Kích thước canvas (px logic) của thẻ node. */
const CARD_W = 260;
const CARD_H = 340;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Ngắt tên thành tối đa `maxLines` dòng vừa bề rộng, dòng cuối thêm "…". */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  let rest = line;
  const used = lines.join(" ");
  rest = text.slice(used.length).trim();
  if (lines.length < maxLines) lines.push(rest);
  // Nếu còn dư chữ ở dòng cuối → cắt bớt + "…".
  const last = lines[lines.length - 1] ?? "";
  if (ctx.measureText(last).width > maxWidth) {
    let s = last;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth)
      s = s.slice(0, -1);
    lines[lines.length - 1] = `${s}…`;
  }
  return lines.filter(Boolean);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Node (mỗi người) + link (cha/mẹ → con, và hôn nhân) cho 3d-force-graph. */
function buildGraph(
  data: TreeData,
  genOffset: number,
  photoUrls: Map<string, string> | undefined,
  pal: Palette,
): { nodes: GNode[]; links: GLink[] } {
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const famById = new Map(data.families.map((f) => [f.id, f]));
  // Huyết thống = thuỷ tổ HOẶC có cha/mẹ trong họ (birth_family_id). Dâu/rể
  // (kết hôn vào) bị loại để đồ thị là CÂY thuần → dagMode "td" xếp tầng được
  // (giống ví dụ "tree" của thư viện). Link hôn nhân/2 cha-mẹ sẽ tạo chu trình
  // làm hỏng dag → chỉ giữ 1 cha/mẹ huyết thống cho mỗi con.
  const isLineage = (id: string | null | undefined) => {
    if (!id) return false;
    const p = personById.get(id);
    return !!p && (p.is_root || p.birth_family_id != null);
  };

  const bloodline = data.persons.filter((p) => isLineage(p.id));
  const ids = new Set(bloodline.map((p) => p.id));

  const nodes: GNode[] = bloodline.map((p) => {
    const avatar = avatarOf(p.gender);
    const photo = p.photo_path ? photoUrls?.get(p.photo_path) : undefined;
    return {
      id: p.id,
      name: p.full_name,
      gender: p.gender,
      isRoot: p.is_root,
      years: [p.birth_date?.slice(0, 4), p.death_date?.slice(0, 4)]
        .filter(Boolean)
        .join("–"),
      gen: displayGen(p.generation, genOffset),
      color: p.is_root ? pal.root : p.gender === "F" ? pal.female : pal.male,
      img: photo ?? avatar,
      avatar,
      childCount: 0,
    };
  });
  const nodeById = new Map(nodes.map((n) => [n.id as string, n]));

  const links: GLink[] = [];
  for (const p of bloodline) {
    if (!p.birth_family_id) continue;
    const f = famById.get(p.birth_family_id);
    if (!f) continue;
    // Ưu tiên nối vào cha/mẹ HUYẾT THỐNG (người mang dòng máu của họ); nếu cả
    // hai đều là dâu/rể thì nối vào chồng, rồi tới vợ.
    const parent = isLineage(f.husband_id)
      ? f.husband_id
      : isLineage(f.wife_id)
        ? f.wife_id
        : f.husband_id ?? f.wife_id;
    if (parent && ids.has(parent)) {
      links.push({ source: parent, target: p.id });
      const pn = nodeById.get(parent);
      if (pn) pn.childCount += 1;
    }
  }
  return { nodes, links };
}

/**
 * Canvas 3D của cây gia phả (3d-force-graph) — mỗi người hiển thị ẢNH (chân
 * dung nếu có, không thì avatar theo giới) kèm TÊN nổi bên dưới; xếp theo
 * tầng đời (dagMode "td"), hạt chạy dọc đường cha→con như ví dụ "tree" của
 * thư viện. Thư viện (three.js) được dynamic-import → chỉ tải khi mở 3D.
 */
export function Tree3DView({
  clanId,
  genOffset,
  className,
}: {
  clanId: string;
  genOffset: number;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  // Toàn màn hình bằng overlay CSS (portal ra <body>) như cây 2D — vào/ra sẽ
  // tạo node mới nên effect dựng lại graph (fs nằm trong deps).
  const [fs, setFs] = useState(false);
  const [showGuide, setShowGuide] = useState(true); // ẩn/hiện bảng hướng dẫn
  // Chế độ "mở rộng dần" (bấm để bung/thu nhánh) — tăng hiệu năng cho họ lớn.
  // null = tự động (bật khi họ đông); người dùng bấm nút sẽ ghi đè.
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null);
  useEffect(() => {
    if (!fs) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFs(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [fs]);

  // Bám theo theme sáng/tối của app (class .dark trên <html>) → dựng lại canvas.
  const [dark, setDark] = useState(isDarkNow);
  useEffect(() => {
    const update = () => setDark(isDarkNow());
    const unsub = subscribeTheme(update);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      unsub();
      mq.removeEventListener("change", update);
    };
  }, []);
  const pal = useMemo(() => palette(dark), [dark]);

  const { data, isLoading } = useQuery({
    queryKey: ["tree3d", clanId],
    queryFn: () => getTreeData(clanId),
    staleTime: 60_000,
  });

  const photoPaths = useMemo(
    () =>
      (data?.persons ?? [])
        .map((p) => p.photo_path)
        .filter((p): p is string => !!p),
    [data],
  );
  const { data: photoUrls } = useQuery({
    queryKey: ["tree3d-photos", clanId, photoPaths.join(",")],
    queryFn: () => getSignedPhotoUrlMap(photoPaths),
    enabled: photoPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });
  // Chờ ảnh xong (nếu có ảnh) mới dựng để khỏi dựng lại + reset camera.
  const photosReady = photoPaths.length === 0 || !!photoUrls;

  // Tự bật mở-rộng-dần khi họ đông (>800 người) để đỡ nặng; người dùng ghi đè được.
  const nodeCount = data?.persons?.length ?? 0;
  const expandable = expandOverride ?? nodeCount > 800;

  useEffect(() => {
    const el = elRef.current;
    if (!data || !photosReady || !el) return;
    let cancelled = false;
    let graph: GraphInstance | null = null;
    let onResize: (() => void) | null = null;
    let onKey: ((e: KeyboardEvent) => void) | null = null;

    // Mỗi người = một THẺ bo tròn (ảnh tròn + tên + năm sinh–mất) vẽ trên canvas.
    const makeNode = (n: NodeObject) => {
      const g = n as GNode;
      const dpr = 2; // vẽ nét 2x cho sắc
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W * dpr;
      canvas.height = CARD_H * dpr;
      const ctx = canvas.getContext("2d")!;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      const material = new SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new Sprite(material);
      const worldH = g.isRoot ? 24 : 18;
      sprite.scale.set((CARD_W / CARD_H) * worldH, worldH, 1);

      const accent = g.color;
      const cx = CARD_W / 2;
      const cy = 112;
      const r = 76;

      const draw = (photo?: HTMLImageElement | null) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, CARD_W, CARD_H);
        // Thân thẻ + viền theo màu giới tính / thuỷ tổ.
        roundRectPath(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 26);
        ctx.fillStyle = pal.card;
        ctx.fill();
        ctx.lineWidth = g.isRoot ? 6 : 4;
        ctx.strokeStyle = accent;
        ctx.stroke();
        // Ảnh tròn (cover) + vòng viền.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = pal.photoBg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        if (photo && photo.width && photo.height) {
          const s = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
          const dw = photo.width * s;
          const dh = photo.height * s;
          ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = accent;
        ctx.stroke();
        // Tên + năm/đời: căn giữa theo chiều dọc vùng DƯỚI ảnh cho cân đối,
        // line-height rộng (40 / 36) để thoáng.
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "700 30px system-ui, -apple-system, sans-serif";
        const lines = wrapText(ctx, g.name, CARD_W - 40, 2);
        const sub = g.years || (g.gen != null ? `Đời ${g.gen}` : "");
        const nameGap = 40;
        const subGap = 36;
        const regionMid = (cy + r + 8 + (CARD_H - 24)) / 2; // giữa vùng dưới ảnh
        const span = (lines.length - 1) * nameGap + (sub ? subGap : 0);
        const firstY = regionMid - span / 2;
        ctx.fillStyle = pal.cardName;
        lines.forEach((ln, i) => ctx.fillText(ln, cx, firstY + i * nameGap));
        if (sub) {
          ctx.fillStyle = pal.cardYears;
          ctx.font = "500 22px system-ui, -apple-system, sans-serif";
          ctx.fillText(sub, cx, firstY + (lines.length - 1) * nameGap + subGap);
        }
        // Badge số con (chế độ mở rộng dần) — nhắc bấm để bung/thu nhánh.
        if (expandable && g.childCount > 0) {
          const bx = CARD_W - 42;
          const by = 50;
          const br = 26;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = pal.card;
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "700 26px system-ui, -apple-system, sans-serif";
          ctx.textBaseline = "middle";
          ctx.fillText(String(g.childCount), bx, by + 1);
          ctx.textBaseline = "alphabetic";
        }
        texture.needsUpdate = true;
      };

      draw(); // khung trống trước, ảnh nạp xong vẽ lại
      void (async () => {
        const primary = await loadImage(g.img);
        if (primary) return draw(primary);
        if (g.img !== g.avatar) {
          const av = await loadImage(g.avatar);
          if (av) draw(av);
        }
      })();

      return sprite;
    };

    void (async () => {
      const ForceGraph3D = (await import("3d-force-graph")).default;
      if (cancelled || !elRef.current) return;
      const { nodes, links } = buildGraph(data, genOffset, photoUrls, pal);

      // Mở rộng dần: gắn danh sách con cho mỗi node, thu gọn mọi nhánh trừ gốc,
      // và chỉ đưa vào graph phần đang bung (getPruned) → nhẹ với họ >1000 người.
      const nodeById = new Map(nodes.map((n) => [n.id as string, n]));
      const roots = nodes.filter((n) => n.isRoot);
      const targetSet = new Set(links.map((l) => l.target));
      const rootSet = roots.length
        ? roots
        : nodes.filter((n) => !targetSet.has(n.id as string));
      const targetId = (l: GLink) =>
        typeof l.target === "object"
          ? ((l.target as GNode).id as string)
          : (l.target as string);
      if (expandable) {
        nodes.forEach((n) => {
          n.childLinks = [];
          n.collapsed = !n.isRoot;
        });
        links.forEach((l) => nodeById.get(l.source)?.childLinks?.push(l));
        if (!roots.length) rootSet.forEach((n) => (n.collapsed = false));
      }
      const getPruned = () => {
        const vN: GNode[] = [];
        const vL: GLink[] = [];
        const seen = new Set<string>();
        const walk = (n: GNode) => {
          const id = n.id as string;
          if (seen.has(id)) return;
          seen.add(id);
          vN.push(n);
          if (n.collapsed) return;
          for (const l of n.childLinks ?? []) {
            vL.push(l);
            const t = nodeById.get(targetId(l));
            if (t) walk(t);
          }
        };
        rootSet.forEach(walk);
        return { nodes: vN, links: vL };
      };

      const flyTo = (node: GNode & { x?: number; y?: number; z?: number }) => {
        const { x = 0, y = 0, z = 0 } = node;
        const ratio = 1 + 90 / (Math.hypot(x, y, z) || 1);
        const newPos =
          x || y || z
            ? { x: x * ratio, y: y * ratio, z: z * ratio }
            : { x: 0, y: 0, z: 90 };
        graph?.cameraPosition(newPos, { x, y, z }, 2500);
      };

      // Dùng trackball mặc định (ổn định): chuột trái xoay, phải di chuyển, lăn
      // phóng to. Không dùng "orbit" vì bản này của lib crash ở onPointerUp.
      graph = new ForceGraph3D(elRef.current)
        .backgroundColor(pal.bg)
        .showNavInfo(false)
        .graphData(expandable ? getPruned() : { nodes, links })
        .nodeThreeObject(makeNode)
        .nodeThreeObjectExtend(false)
        .nodeLabel((n) => {
          const g = n as GNode;
          const meta: string[] = [];
          if (g.years) meta.push(g.years);
          if (g.gen != null) meta.push(`Đời ${g.gen}`);
          const sub = meta.length
            ? `<div style="font-size:11px;opacity:.8">${meta.join(" · ")}</div>`
            : "";
          return `<div style="text-align:center"><b>${g.name}</b>${sub}</div>`;
        })
        .linkColor(() => pal.link)
        .linkWidth(0.6)
        .linkOpacity(0.4)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleWidth(0.8)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleColor(() => pal.particle)
        // Chữ "con trai/con gái" nổi giữa mỗi đường cha→con (ví dụ text-links).
        .linkThreeObjectExtend(true)
        .linkThreeObject((l) => {
          const t = (l as { target: unknown }).target;
          const gender =
            t && typeof t === "object" ? (t as GNode).gender : undefined;
          const s = new SpriteText(gender === "F" ? "con gái" : "con trai");
          s.color = pal.linkText;
          s.textHeight = 2.4;
          s.fontWeight = "500";
          return s;
        })
        .linkPositionUpdate((sprite, { start, end }) => {
          if (sprite)
            sprite.position.set(
              start.x + (end.x - start.x) / 2,
              start.y + (end.y - start.y) / 2,
              start.z + (end.z - start.z) / 2,
            );
          return false;
        })
        .dagMode("td")
        .dagLevelDistance(90)
        .onDagError(() => {})
        // Bấm 1 thẻ: mở/thu nhánh con (nếu bật mở-rộng-dần) rồi bay camera tới.
        .onNodeClick((n) => {
          const node = n as GNode & { x?: number; y?: number; z?: number };
          if (expandable && node.childCount > 0) {
            node.collapsed = !node.collapsed;
            graph?.graphData(getPruned());
          }
          flyTo(node);
        });
      // Giãn vừa phải cho đỡ đè mà vẫn gọn dễ nhìn.
      graph.d3Force("charge")?.strength(-360);
      graph.d3Force("link")?.distance(28);

      onResize = () => {
        if (!elRef.current || !graph) return;
        graph.width(elRef.current.clientWidth).height(elRef.current.clientHeight);
      };
      onResize();
      window.addEventListener("resize", onResize);

      // Phím tắt: +/- phóng to-nhỏ, R về toàn cảnh.
      onKey = (e: KeyboardEvent) => {
        if (!graph) return;
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.key === "r" || e.key === "R") {
          graph.zoomToFit(600, 40);
        } else if (e.key === "+" || e.key === "=" || e.key === "-") {
          const cam = graph.camera();
          const f = e.key === "-" ? 1.25 : 0.8;
          graph.cameraPosition(
            {
              x: cam.position.x * f,
              y: cam.position.y * f,
              z: cam.position.z * f,
            },
            undefined,
            200,
          );
        }
      };
      window.addEventListener("keydown", onKey);
    })();

    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener("resize", onResize);
      if (onKey) window.removeEventListener("keydown", onKey);
      graph?._destructor?.();
    };
  }, [data, genOffset, photoUrls, photosReady, pal, fs, expandable]);

  const kbd =
    "rounded border border-border bg-muted px-1 font-mono text-[10px]";

  const node = (
    <div
      className={
        fs
          ? "fixed inset-0 z-[60] bg-background"
          : `relative overflow-hidden ${className ?? ""}`
      }
    >
      {/* Chỉ canvas 3D mount vào đây; overlay là SIBLING phía sau nên nổi trên. */}
      <div ref={elRef} className="absolute inset-0" />
      {(isLoading || !photosReady) && (
        <p className="absolute inset-0 grid place-items-center text-muted-foreground">
          Đang tải…
        </p>
      )}

      {/* Góc trên phải: bật/tắt mở-rộng-dần + toàn màn hình. */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpandOverride(!expandable)}
          className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-md border bg-card/90 px-2.5 text-xs text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card"
          aria-pressed={expandable}
          title={
            expandable
              ? "Đang bật: bấm thẻ để bung/thu nhánh (nhẹ với họ lớn)"
              : "Bật mở rộng dần: chỉ hiện gốc, bấm để bung từng nhánh"
          }
        >
          <span
            className={`h-2 w-2 rounded-full ${expandable ? "bg-primary" : "bg-muted-foreground/50"}`}
          />
          Mở rộng dần
        </button>
        <button
          type="button"
          onClick={() => setFs((v) => !v)}
          className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card/90 text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card"
          aria-label={fs ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
          title={fs ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
        >
          {fs ? (
            <IconMinimize className="h-4 w-4" />
          ) : (
            <IconMaximize className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Chú thích màu — góc trên trái, nổi trên canvas (z-10). */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-border bg-background/85 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.male }} /> Nam
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.female }} /> Nữ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.root }} /> Thuỷ tổ
          </span>
        </div>
      </div>

      {/* Hướng dẫn điều khiển — góc dưới trái, tắt được cho đỡ chiếm chỗ. */}
      {showGuide ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[16rem] space-y-1 rounded-lg border border-border bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Cách xem</span>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="pointer-events-auto -mr-1 -mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Ẩn hướng dẫn"
              title="Ẩn hướng dẫn"
            >
              ✕
            </button>
          </div>
          {/* Máy tính */}
          <div className="hidden space-y-1 sm:block">
            <div>
              <b className="text-foreground">Chuột trái</b> kéo — xoay
            </div>
            <div>
              <b className="text-foreground">Chuột phải</b> kéo — di chuyển
            </div>
            <div>
              <b className="text-foreground">Lăn chuột</b> — phóng to / thu nhỏ
            </div>
            <div>
              <b className="text-foreground">Bấm một thẻ</b> —{" "}
              {expandable ? "bung / thu nhánh con" : "bay tới xem"}
            </div>
            {expandable && (
              <div>Số trong vòng tròn = số con có thể bung.</div>
            )}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              Phím tắt:
              <kbd className={kbd}>+</kbd>/<kbd className={kbd}>−</kbd> phóng to·nhỏ ·
              <kbd className={kbd}>R</kbd> toàn cảnh
            </div>
          </div>
          {/* Điện thoại */}
          <div className="space-y-1 sm:hidden">
            <div>Vuốt 1 ngón để xoay, di chuyển</div>
            <div>Kéo 2 ngón để phóng to / thu nhỏ</div>
            <div>
              Chạm thẻ để {expandable ? "bung / thu nhánh" : "bay tới xem"}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="pointer-events-auto absolute bottom-3 left-3 z-10 inline-flex items-center gap-1 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
          aria-label="Hiện hướng dẫn"
          title="Hiện hướng dẫn"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold">
            ?
          </span>
          Cách xem
        </button>
      )}
    </div>
  );

  return fs ? createPortal(node, document.body) : node;
}
