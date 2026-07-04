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

/** Số node tối đa dựng cùng lúc (giữ mượt trên điện thoại). Phần còn lại
 *  ẩn dưới các thẻ có badge số con — bấm để bung thêm. */
const RENDER_CAP = 500;

type GraphInstance = ForceGraph3DInstance;

type GLink = { source: string; target: string; kind: "parent" | "marriage" };
type GNode = NodeObject & {
  name: string;
  gender: "M" | "F";
  isRoot: boolean;
  inLaw: boolean; // dâu/rể (kết hôn vào, không mang dòng máu)
  years: string;
  gen: number | null;
  tier: number | null; // đời (số thô) để ghim toạ độ dọc; dâu/rể = đời vợ/chồng
  color: string;
  img: string;
  avatar: string;
  childCount: number; // số con trực tiếp (badge + biết có mở rộng được không)
  childLinks?: GLink[]; // cạnh cha→con (mở rộng dần đi theo cạnh này)
  spouseLinks?: GLink[]; // cạnh hôn nhân (kéo dâu/rể xuất hiện cùng vợ/chồng)
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
        marriage: "#D24545", // --primary (oxblood, dark) — cạnh hôn nhân
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
        marriage: "#9B3535", // --primary (oxblood, light) — cạnh hôn nhân
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

/**
 * Node + link cho 3d-force-graph. GỒM CẢ dâu/rể (kết hôn vào) — nối bằng cạnh
 * hôn nhân. Vì có dâu/rể + hôn nhân nên KHÔNG dùng dagMode (sẽ tạo chu trình);
 * thay vào đó mỗi node được GHIM toạ độ dọc theo `tier` (đời) ở component.
 */
function buildGraph(
  data: TreeData,
  genOffset: number,
  photoUrls: Map<string, string> | undefined,
  pal: Palette,
): { nodes: GNode[]; links: GLink[] } {
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const famById = new Map(data.families.map((f) => [f.id, f]));
  // Huyết thống = thuỷ tổ HOẶC có cha/mẹ trong họ (birth_family_id).
  const isLineage = (id: string | null | undefined) => {
    if (!id) return false;
    const p = personById.get(id);
    return !!p && (p.is_root || p.birth_family_id != null);
  };

  // Bản đồ vợ/chồng (từ các gia đình) để suy ra đời cho dâu/rể + kéo họ hiện ra.
  const spouseOf = new Map<string, string[]>();
  const addSpouse = (a: string, b: string) => {
    if (!spouseOf.has(a)) spouseOf.set(a, []);
    spouseOf.get(a)!.push(b);
  };
  for (const f of data.families) {
    if (f.husband_id && f.wife_id) {
      addSpouse(f.husband_id, f.wife_id);
      addSpouse(f.wife_id, f.husband_id);
    }
  }

  // Người được đưa vào: huyết thống, HOẶC dâu/rể có vợ/chồng là huyết thống.
  const included = data.persons.filter(
    (p) =>
      isLineage(p.id) ||
      (spouseOf.get(p.id) ?? []).some((s) => isLineage(s)),
  );
  const ids = new Set(included.map((p) => p.id));

  const tierOf = (p: (typeof data.persons)[number]) => {
    if (isLineage(p.id)) return p.generation ?? null;
    // Dâu/rể → lấy đời của vợ/chồng huyết thống.
    for (const s of spouseOf.get(p.id) ?? []) {
      const g = personById.get(s)?.generation;
      if (g != null) return g;
    }
    return p.generation ?? null;
  };

  const nodes: GNode[] = included.map((p) => {
    const avatar = avatarOf(p.gender);
    const photo = p.photo_path ? photoUrls?.get(p.photo_path) : undefined;
    const inLaw = !isLineage(p.id);
    const tier = tierOf(p);
    return {
      id: p.id,
      name: p.full_name,
      gender: p.gender,
      isRoot: p.is_root,
      inLaw,
      years: [p.birth_date?.slice(0, 4), p.death_date?.slice(0, 4)]
        .filter(Boolean)
        .join("–"),
      gen: displayGen(tier, genOffset),
      tier,
      color: p.is_root ? pal.root : p.gender === "F" ? pal.female : pal.male,
      img: photo ?? avatar,
      avatar,
      childCount: 0,
    };
  });
  const nodeById = new Map(nodes.map((n) => [n.id as string, n]));

  const links: GLink[] = [];
  // Cạnh cha/mẹ → con: nối vào MỘT cha/mẹ huyết thống (để cây/mở-rộng-dần gọn).
  for (const p of included) {
    if (!p.birth_family_id) continue;
    const f = famById.get(p.birth_family_id);
    if (!f) continue;
    const parent = isLineage(f.husband_id)
      ? f.husband_id
      : isLineage(f.wife_id)
        ? f.wife_id
        : f.husband_id ?? f.wife_id;
    if (parent && ids.has(parent)) {
      links.push({ source: parent, target: p.id, kind: "parent" });
      const pn = nodeById.get(parent);
      if (pn) pn.childCount += 1;
    }
  }
  // Cạnh hôn nhân (dedup) — để dâu/rể đứng cạnh vợ/chồng.
  const seen = new Set<string>();
  for (const f of data.families) {
    if (!f.husband_id || !f.wife_id) continue;
    if (!ids.has(f.husband_id) || !ids.has(f.wife_id)) continue;
    const key = [f.husband_id, f.wife_id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: f.husband_id, target: f.wife_id, kind: "marriage" });
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
  focal = null,
  className,
}: {
  clanId: string;
  genOffset: number;
  /** Người làm trung tâm (do trang cha điều khiển qua ô tìm chung với cây 2D). */
  focal?: string | null;
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

  // Tự bật mở-rộng-dần khi họ đông (>RENDER_CAP người); người dùng ghi đè được.
  const nodeCount = data?.persons?.length ?? 0;
  const expandable = expandOverride ?? nodeCount > RENDER_CAP;

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
        // Thân thẻ + viền theo màu giới tính / thuỷ tổ. Dâu/rể → viền đứt nét.
        roundRectPath(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 26);
        ctx.fillStyle = pal.card;
        ctx.fill();
        if (g.inLaw) ctx.setLineDash([11, 8]);
        ctx.lineWidth = g.isRoot ? 6 : 4;
        ctx.strokeStyle = accent;
        ctx.stroke();
        ctx.setLineDash([]);
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
        if (g.inLaw) ctx.setLineDash([11, 8]);
        ctx.lineWidth = 6;
        ctx.strokeStyle = accent;
        ctx.stroke();
        ctx.setLineDash([]);
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

      const nodeById = new Map(nodes.map((n) => [n.id as string, n]));
      const endId = (v: unknown) =>
        typeof v === "object" ? ((v as GNode).id as string) : (v as string);
      const srcId = (l: GLink) => endId(l.source);
      const targetId = (l: GLink) => endId(l.target);

      // Ghim đời: thay cho dagMode, mỗi node cố định toạ độ DỌC theo `tier` (đời)
      // → dâu/rể + cạnh hôn nhân không làm hỏng cách xếp tầng.
      const LEVEL = 50;
      nodes.forEach((n) => {
        n.fy = n.tier != null ? -n.tier * LEVEL : undefined;
      });

      // Cạnh cha→con (childLinks) để mở-rộng-dần; cạnh hôn nhân (spouseLinks) để
      // kéo dâu/rể hiện ra cạnh vợ/chồng.
      nodes.forEach((n) => {
        n.childLinks = [];
        n.spouseLinks = [];
      });
      for (const l of links) {
        if (l.kind === "parent") nodeById.get(srcId(l))?.childLinks?.push(l);
        else {
          nodeById.get(srcId(l))?.spouseLinks?.push(l);
          nodeById.get(targetId(l))?.spouseLinks?.push(l);
        }
      }
      const roots = nodes.filter((n) => n.isRoot);
      const parentOf = new Map<string, string>();
      const childTargets = new Set<string>();
      for (const l of links) {
        if (l.kind !== "parent") continue;
        parentOf.set(targetId(l), srcId(l));
        childTargets.add(targetId(l));
      }
      const rootSet = roots.length
        ? roots
        : nodes.filter((n) => !n.inLaw && !childTargets.has(n.id as string));
      const childIdsOf = (n: GNode) =>
        (n.childLinks ?? []).map((l) => targetId(l));

      // Khởi tạo thu gọn: BUNG quanh NGƯỜI TRUNG TÂM, tối đa RENDER_CAP node —
      // ưu tiên đường từ gốc xuống người đó rồi lan ra con cháu; phần còn lại
      // để thu gọn (bấm để bung). Giữ mượt cho họ vài nghìn người trên điện thoại.
      const initCollapse = (focalId: string | null) => {
        nodes.forEach((n) => (n.collapsed = true));
        const shown = new Set<string>();
        rootSet.forEach((r) => shown.add(r.id as string));
        const order: string[] = [];
        if (focalId && nodeById.has(focalId)) {
          const chain: string[] = [];
          const guard = new Set<string>();
          let cur: string | undefined = focalId;
          while (cur && !guard.has(cur)) {
            guard.add(cur);
            chain.push(cur);
            cur = parentOf.get(cur);
          }
          chain.reverse().forEach((id) => {
            order.push(id);
            shown.add(id);
          });
        }
        const start =
          focalId && nodeById.has(focalId)
            ? [focalId]
            : rootSet.map((n) => n.id as string);
        const queue = [...order, ...start];
        for (let i = 0; i < queue.length && shown.size < RENDER_CAP; i++) {
          const n = nodeById.get(queue[i]);
          if (!n) continue;
          const kids = childIdsOf(n).filter((c) => !shown.has(c));
          if (shown.size + kids.length > RENDER_CAP) continue; // bung sẽ vượt → giữ gọn
          n.collapsed = false;
          for (const c of kids) {
            shown.add(c);
            queue.push(c);
          }
        }
      };
      if (expandable) initCollapse(focal);

      // Phần đang hiển thị: full khi tắt mở-rộng-dần; khi bật thì duyệt cây huyết
      // thống rồi bổ sung dâu/rể của những người đang hiện.
      const getVisible = () => {
        if (!expandable) return { nodes, links };
        const vN: GNode[] = [];
        const vL = new Set<GLink>();
        const seen = new Set<string>();
        const walk = (n: GNode) => {
          const id = n.id as string;
          if (seen.has(id)) return;
          seen.add(id);
          vN.push(n);
          if (n.collapsed) return;
          for (const l of n.childLinks ?? []) {
            vL.add(l);
            const t = nodeById.get(targetId(l));
            if (t) walk(t);
          }
        };
        rootSet.forEach(walk);
        for (const n of [...vN]) {
          for (const l of n.spouseLinks ?? []) {
            const other = srcId(l) === (n.id as string) ? targetId(l) : srcId(l);
            const sp = nodeById.get(other);
            if (sp && !seen.has(other)) {
              seen.add(other);
              vN.push(sp);
            }
            vL.add(l);
          }
        }
        return { nodes: vN, links: [...vL] };
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
        .graphData(getVisible())
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
        // Màu cạnh cho biết quan hệ: hôn nhân = đỏ rượu; cha→con = màu theo giới
        // của người con (trai xanh, gái hồng).
        .linkColor((l) => {
          const link = l as GLink;
          if (link.kind === "marriage") return pal.marriage;
          const t = link.target as unknown;
          const gender =
            t && typeof t === "object" ? (t as GNode).gender : undefined;
          return gender === "F" ? pal.female : pal.male;
        })
        .linkWidth((l) => ((l as GLink).kind === "marriage" ? 1.2 : 0.8))
        .linkOpacity(0.55)
        // Hạt chạy chỉ trên cạnh cha→con (hôn nhân là quan hệ ngang, không hạt).
        .linkDirectionalParticles((l) =>
          (l as GLink).kind === "marriage" ? 0 : 2,
        )
        .linkDirectionalParticleWidth(0.9)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleColor((l) => {
          const t = (l as GLink).target as unknown;
          const gender =
            t && typeof t === "object" ? (t as GNode).gender : undefined;
          return gender === "F" ? pal.female : pal.male;
        })
        // Chữ giữa mỗi cạnh: "con trai/con gái" (cha→con) hoặc "vợ chồng".
        .linkThreeObjectExtend(true)
        .linkThreeObject((l) => {
          const link = l as GLink;
          let label: string;
          if (link.kind === "marriage") {
            label = "vợ chồng";
          } else {
            const t = (l as { target: unknown }).target;
            const gender =
              t && typeof t === "object" ? (t as GNode).gender : undefined;
            label = gender === "F" ? "con gái" : "con trai";
          }
          const s = new SpriteText(label);
          s.color = link.kind === "marriage" ? pal.marriage : pal.linkText;
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
        // Bấm 1 thẻ: mở/thu nhánh con (nếu bật mở-rộng-dần) rồi bay camera tới.
        .onNodeClick((n) => {
          const node = n as GNode & { x?: number; y?: number; z?: number };
          if (expandable && node.childCount > 0) {
            node.collapsed = !node.collapsed;
            graph?.graphData(getVisible());
          }
          flyTo(node);
        });
      // Xếp sát lại (~1/2 khoảng cách cũ) cho đỡ trống trải mà không quá chật.
      graph.d3Force("charge")?.strength(-180);
      graph.d3Force("link")?.distance(14);

      // Khi layout ổn định lần đầu → bay tới người trung tâm cho vào giữa khung.
      let flew = false;
      graph.onEngineStop(() => {
        if (flew) return;
        const fn = focal ? nodeById.get(focal) : null;
        if (fn && (fn as { x?: number }).x != null) {
          flew = true;
          flyTo(fn as GNode & { x?: number; y?: number; z?: number });
        }
      });

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
  }, [data, genOffset, photoUrls, photosReady, pal, fs, expandable, focal]);

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

      {/* Hướng dẫn + chú thích màu — góc dưới trái, tắt được cho đỡ chiếm chỗ. */}
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
          {/* Chú thích màu: thẻ theo giới, đường theo quan hệ. */}
          <div className="mt-1.5 space-y-1 border-t border-border pt-1.5 text-foreground">
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
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground" /> Dâu/rể
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-4 rounded" style={{ background: pal.male }} /> Con trai
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-4 rounded" style={{ background: pal.female }} /> Con gái
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-4 rounded" style={{ background: pal.marriage }} /> Vợ chồng
              </span>
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
