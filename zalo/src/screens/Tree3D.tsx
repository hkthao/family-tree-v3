import { useEffect, useRef, useState } from "react";

import type { TreeData } from "@/lib/queries/tree";
import { hasWebGL } from "@/lib/webglSupport";

/**
 * Cây 3D — cùng thư viện (3d-force-graph) với bản web và cùng cách xếp:
 * mỗi đời ghim một tầng theo chiều dọc, nét xanh nối cha mẹ với con trai,
 * hồng với con gái, đỏ cho vợ chồng. Bản Mini App lược phần ảnh chân dung
 * trên nút và các hiệu ứng hạt chạy của web để nhẹ máy điện thoại: mỗi
 * người là một nhãn tên tô theo giới tính.
 */
const C = { male: "#5B9BD5", female: "#E58BA8", marriage: "#C8475A" };

export function Tree3D({
  data,
  visible,
  openPerson,
}: {
  data: TreeData;
  /** Chỉ vẽ những người này (lọc theo số đời); null = cả cây. */
  visible: Set<string> | null;
  openPerson: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(openPerson);
  openRef.current = openPerson;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!hasWebGL()) {
      setError("Máy này không hỗ trợ đồ hoạ 3D. Hãy dùng kiểu 2D hoặc Thư mục.");
      return;
    }
    let disposed = false;
    let graph: { _destructor?: () => void; width: (n: number) => unknown; height: (n: number) => unknown } | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const [{ default: ForceGraph3D }, { default: SpriteText }] = await Promise.all([
        import("3d-force-graph"),
        import("three-spritetext"),
      ]);
      if (disposed) return;

      const people = data.persons.filter((p) => !visible || visible.has(p.id));
      const ids = new Set(people.map((p) => p.id));
      const minGen = people.reduce((m, p) => Math.min(m, p.generation ?? Infinity), Infinity);
      const nodes = people.map((p) => ({
        id: p.id,
        name: p.full_name,
        gender: p.gender,
        // Ghim tầng theo đời: thay cho dagMode (dâu/rể + hôn nhân tạo chu
        // trình nên không dùng dagMode được — cùng lý do với web).
        fy: -((p.generation ?? minGen) - (Number.isFinite(minGen) ? minGen : 0)) * 46,
      }));
      const famById = new Map(data.families.map((f) => [f.id, f]));
      const links: { source: string; target: string; color: string }[] = [];
      for (const p of people) {
        const fam = p.birth_family_id ? famById.get(p.birth_family_id) : undefined;
        for (const parent of [fam?.husband_id, fam?.wife_id]) {
          if (parent && ids.has(parent)) {
            links.push({ source: parent, target: p.id, color: p.gender === "M" ? C.male : C.female });
          }
        }
      }
      for (const f of data.families) {
        if (f.husband_id && f.wife_id && ids.has(f.husband_id) && ids.has(f.wife_id)) {
          links.push({ source: f.husband_id, target: f.wife_id, color: C.marriage });
        }
      }

      const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const g = new (ForceGraph3D as unknown as new (el: HTMLElement) => any)(node)
        .backgroundColor(dark ? "#1A1612" : "#FBF7F0")
        .width(node.clientWidth)
        .height(node.clientHeight)
        .showNavInfo(false)
        .nodeThreeObject((n: { name: string; gender: "M" | "F" }) => {
          const s = new SpriteText(n.name);
          s.textHeight = 5;
          s.color = dark ? "#EFE9DB" : "#2A2320";
          s.backgroundColor = n.gender === "M" ? (dark ? "#2F3D48" : "#D4DDE4") : dark ? "#4A2F2D" : "#E8D2CC";
          s.padding = 1.5;
          s.borderRadius = 1.5;
          return s;
        })
        .linkColor((l: { color: string }) => l.color)
        .linkOpacity(0.7)
        .linkWidth(0.6)
        .onNodeClick((n: { id: string }) => openRef.current(n.id))
        .graphData({ nodes, links })
        .cooldownTime(5000);
      g.d3Force("charge")?.strength(-160);
      g.d3Force("link")?.distance(16);
      setTimeout(() => !disposed && g.zoomToFit(600, 30), 1200);
      graph = g;

      ro = new ResizeObserver(() => {
        g.width(node.clientWidth);
        g.height(node.clientHeight);
      });
      ro.observe(node);
    })().catch((e: Error) => {
      console.error("3d init failed:", e);
      if (!disposed) setError("Không dựng được cây 3D trên máy này.");
    });

    return () => {
      disposed = true;
      ro?.disconnect();
      graph?._destructor?.();
      node.innerHTML = "";
    };
  }, [data, visible]);

  if (error) {
    return (
      <div className="card empty" style={{ margin: 12 }}>
        <p className="muted" style={{ margin: 0 }}>{error}</p>
      </div>
    );
  }
  return <div ref={ref} className="canvas" />;
}
