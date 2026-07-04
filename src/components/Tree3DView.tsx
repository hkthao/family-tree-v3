import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { ForceGraph3DInstance, NodeObject } from "3d-force-graph";
import {
  Group,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import SpriteText from "three-spritetext";

import { displayGen } from "@/lib/displayGeneration";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { getTreeData, type TreeData } from "@/lib/queries/tree";

type GraphInstance = ForceGraph3DInstance;

type GNode = NodeObject & {
  name: string;
  gender: "M" | "F";
  isRoot: boolean;
  years: string;
  gen: number | null;
  color: string;
  img: string;
  avatar: string;
};
type GLink = { source: string; target: string; kind: "parent" | "marriage" };

const COLOR = {
  male: "#7FA8D0",
  female: "#D69AA0",
  root: "#C19A5B",
  bg: "#161210",
  label: "#EFE9DB",
  parentLink: "#6E655E",
  marriageLink: "#C19A5B",
};

const avatarOf = (g: "M" | "F") =>
  g === "M" ? "/avatars/male.png" : "/avatars/female.png";

/** Node (mỗi người) + link (cha/mẹ → con, và hôn nhân) cho 3d-force-graph. */
function buildGraph(
  data: TreeData,
  genOffset: number,
  photoUrls: Map<string, string> | undefined,
): { nodes: GNode[]; links: GLink[] } {
  const ids = new Set(data.persons.map((p) => p.id));
  const famById = new Map(data.families.map((f) => [f.id, f]));

  const nodes: GNode[] = data.persons.map((p) => {
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
      color: p.is_root ? COLOR.root : p.gender === "F" ? COLOR.female : COLOR.male,
      img: photo ?? avatar,
      avatar,
    };
  });

  const links: GLink[] = [];
  const seenMarriage = new Set<string>();
  for (const f of data.families) {
    if (f.husband_id && f.wife_id && ids.has(f.husband_id) && ids.has(f.wife_id)) {
      const key = [f.husband_id, f.wife_id].sort().join("|");
      if (!seenMarriage.has(key)) {
        seenMarriage.add(key);
        links.push({ source: f.husband_id, target: f.wife_id, kind: "marriage" });
      }
    }
  }
  for (const p of data.persons) {
    if (!p.birth_family_id) continue;
    const f = famById.get(p.birth_family_id);
    if (!f) continue;
    if (f.husband_id && ids.has(f.husband_id))
      links.push({ source: f.husband_id, target: p.id, kind: "parent" });
    if (f.wife_id && ids.has(f.wife_id))
      links.push({ source: f.wife_id, target: p.id, kind: "parent" });
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

  useEffect(() => {
    const el = elRef.current;
    if (!data || !photosReady || !el) return;
    let cancelled = false;
    let graph: GraphInstance | null = null;
    let onResize: (() => void) | null = null;
    const texLoader = new TextureLoader();

    const makeNode = (n: NodeObject) => {
      const g = n as GNode;
      const group = new Group();
      const material = new SpriteMaterial({ transparent: true, depthWrite: false });
      const applyTex = (url: string, fallback?: string) =>
        texLoader.load(
          url,
          (t) => {
            t.colorSpace = SRGBColorSpace;
            material.map = t;
            material.needsUpdate = true;
          },
          undefined,
          fallback ? () => applyTex(fallback) : undefined,
        );
      applyTex(g.img, g.img === g.avatar ? undefined : g.avatar);
      const sprite = new Sprite(material);
      const size = g.isRoot ? 14 : 10;
      sprite.scale.set(size, size, 1);
      group.add(sprite);

      const label = new SpriteText(g.name);
      label.color = g.isRoot ? COLOR.root : COLOR.label;
      label.textHeight = g.isRoot ? 4 : 3;
      label.fontWeight = g.isRoot ? "700" : "600";
      label.backgroundColor = "rgba(20,16,14,0.55)";
      label.padding = 1.5;
      label.borderRadius = 2;
      label.position.set(0, -(size / 2 + 3), 0);
      group.add(label);
      return group;
    };

    void (async () => {
      const ForceGraph3D = (await import("3d-force-graph")).default;
      if (cancelled || !elRef.current) return;
      const { nodes, links } = buildGraph(data, genOffset, photoUrls);

      graph = new ForceGraph3D(elRef.current)
        .backgroundColor(COLOR.bg)
        .showNavInfo(false)
        .graphData({ nodes, links })
        .nodeThreeObject(makeNode)
        .nodeThreeObjectExtend(false)
        .nodeLabel((n) => {
          const g = n as GNode;
          const bits: string[] = [];
          if (g.gen != null) bits.push(`Đời ${g.gen}`);
          if (g.years) bits.push(g.years);
          return bits.join(" · ");
        })
        .linkColor((l) =>
          (l as unknown as GLink).kind === "marriage"
            ? COLOR.marriageLink
            : COLOR.parentLink,
        )
        .linkWidth((l) => ((l as unknown as GLink).kind === "marriage" ? 0.8 : 1))
        .linkOpacity(0.45)
        .linkDirectionalParticles((l) =>
          (l as unknown as GLink).kind === "parent" ? 2 : 0,
        )
        .linkDirectionalParticleWidth(0.8)
        .linkDirectionalParticleSpeed(0.006)
        .dagMode("td")
        .dagLevelDistance(60)
        .onDagError(() => {})
        .onNodeClick((n) => {
          const node = n as GNode & { x: number; y: number; z: number };
          const dist = 100;
          const hyp = Math.hypot(node.x, node.y, node.z) || 1;
          const r = 1 + dist / hyp;
          graph?.cameraPosition(
            { x: node.x * r, y: node.y * r, z: node.z * r },
            node,
            900,
          );
        });
      // Giãn các node cho đỡ đè ảnh lên nhau.
      graph.d3Force("charge")?.strength(-160);

      onResize = () => {
        if (!elRef.current || !graph) return;
        graph.width(elRef.current.clientWidth).height(elRef.current.clientHeight);
      };
      onResize();
      window.addEventListener("resize", onResize);
    })();

    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener("resize", onResize);
      graph?._destructor?.();
    };
  }, [data, genOffset, photoUrls, photosReady]);

  return (
    <div ref={elRef} className={`relative overflow-hidden ${className ?? ""}`}>
      {(isLoading || !photosReady) && (
        <p className="absolute inset-0 grid place-items-center text-muted-foreground">
          Đang tải…
        </p>
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.male }} /> Nam
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.female }} /> Nữ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.root }} /> Thuỷ tổ
          </span>
        </div>
        <div className="mt-1">Kéo để xoay · lăn chuột phóng to · bấm một người để lại gần.</div>
      </div>
    </div>
  );
}
