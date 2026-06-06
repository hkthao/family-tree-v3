import { useEffect, useRef } from "react";

import type {
  InlawPeerRelatives,
  InlawRelativeCard,
} from "@/lib/queries/person-links";

/**
 * Small family-chart instance rendering the peer's one-hop family —
 * parents above, the focal person in the middle (oxblood border via
 * the special id we feed setOnCardUpdate), spouses beside, children
 * below. Same data the list-view InlawFamilyCard uses, just drawn as
 * an SVG tree.
 *
 * Masked rows render as "Người còn sống" cards with the matching
 * gender colour so the topology stays readable without exposing
 * identifying info.
 *
 * Topology: each child carries `other_parent_id` from the RPC, so we
 * draw multi-spouse families correctly — child X parented by
 * (peer, spouse_A) sits below the peer+spouse_A subtree; child Y
 * parented by (peer, spouse_B) under the peer+spouse_B subtree.
 * Children whose other_parent_id is null (single-parent family) hang
 * off peer alone.
 */
export function InlawMiniTree({ data }: { data: InlawPeerRelatives }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let disposed = false;
    const node = ref.current;

    (async () => {
      const f3 = await loadF3();
      if (disposed) return;
      node.innerHTML = "";

      const f3Data = buildMiniTreeData(data);
      try {
        const built = (
          f3 as unknown as {
            createChart: (el: HTMLElement, d: unknown) => F3Chart;
          }
        ).createChart(node, f3Data);

        const card = built.setCardSvg?.();
        card
          ?.setCardDisplay([
            (d) => String((d as DatumNode).data?.["full name"] ?? "—"),
            (d) => String((d as DatumNode).data?.["lifespan"] ?? ""),
          ])
          .setCardDim({
            w: 220,
            h: 64,
            text_x: 56,
            text_y: 18,
            img_w: 44,
            img_h: 44,
            img_x: 6,
            img_y: 10,
          })
          .setOnCardUpdate(function (d) {
            const datum = d.data as DatumNode | undefined;
            const isPeer = datum?.id === data.peer.id;
            // Highlight the focal with an oxblood border so the
            // tree reads as "this person's family on the other side."
            this.querySelector(".peer-highlight")?.remove();
            if (isPeer) {
              const highlight = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "rect",
              );
              highlight.setAttribute("class", "peer-highlight");
              highlight.setAttribute("x", "-2");
              highlight.setAttribute("y", "-2");
              highlight.setAttribute("width", "224");
              highlight.setAttribute("height", "68");
              highlight.setAttribute("rx", "8");
              highlight.setAttribute("fill", "none");
              highlight.setAttribute("stroke", "#7A2E2E");
              highlight.setAttribute("stroke-width", "2");
              const body = this.querySelector(".card-body");
              body?.insertBefore(highlight, body.firstChild);
            }
            // Centre the lifespan tspan under the name (the library
            // hard-codes x=0 on each tspan, so reposition).
            const tspans = this.querySelectorAll<SVGTSpanElement>(
              ".card-text text tspan",
            );
            const meta = tspans[1];
            if (meta) {
              meta.setAttribute("text-anchor", "start");
              meta.setAttribute("x", "0");
              meta.setAttribute("dy", "16");
            }
          });

        built.setTransitionTime(0);
        built.setOrientationVertical?.();
        built.setCardXSpacing(240);
        built.setCardYSpacing(120);
        built.setSingleParentEmptyCard(false);
        built.updateMainId?.(data.peer.id);

        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (disposed) return;
        built.updateTree({ initial: true });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("InlawMiniTree init failed", e);
      }
    })();

    return () => {
      disposed = true;
      node.innerHTML = "";
    };
  }, [data]);

  return (
    <div
      ref={ref}
      className="f3 rounded-md border bg-card text-foreground h-[360px] overflow-hidden"
      style={
        {
          "--male-color": "var(--tree-card-male)",
          "--female-color": "var(--tree-card-female)",
          "--genderless-color": "var(--tree-card-genderless)",
        } as React.CSSProperties
      }
      aria-label={`Mini cây gia đình của ${data.peer.full_name ?? "người này"}`}
    />
  );
}

// ─── family-chart bootstrap types ────────────────────────────────────

interface F3Chart {
  setCardSvg?: () => F3Card;
  setCardYSpacing: (n: number) => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setTransitionTime: (n: number) => F3Chart;
  setSingleParentEmptyCard: (b: boolean) => F3Chart;
  updateTree: (opts: { initial?: boolean }) => void;
  updateMainId?: (id: string) => void;
}
interface F3Card {
  setCardDisplay: (lines: (CardDisplayFn | string | string[])[]) => F3Card;
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
  setOnCardUpdate: (fn: OnCardUpdateFn) => F3Card;
}
type OnCardUpdateFn = (this: SVGGElement, d: { data?: DatumNode }) => void;
interface DatumNode {
  id?: string;
  data?: Record<string, unknown>;
}
type CardDisplayFn = (d: DatumNode) => string;

let f3Module: typeof import("family-chart") | null = null;
async function loadF3(): Promise<typeof import("family-chart")> {
  if (!f3Module) f3Module = await import("family-chart");
  return f3Module;
}

// ─── Data shaping ────────────────────────────────────────────────────

interface F3Datum {
  id: string;
  data: {
    gender: "M" | "F";
    "full name": string;
    lifespan: string;
    avatar: string;
  };
  rels: {
    parents?: string[];
    spouses?: string[];
    children?: string[];
  };
}

function genderAvatar(g: "M" | "F"): string {
  return g === "M" ? "/avatars/male.png" : "/avatars/female.png";
}

function entryFor(
  r: InlawRelativeCard,
  rels: F3Datum["rels"],
): F3Datum {
  return {
    id: r.id,
    data: {
      gender: r.gender,
      "full name": r.masked
        ? "Người còn sống"
        : (r.full_name ?? "—"),
      lifespan: r.masked ? "—" : formatLifespan(r),
      avatar: genderAvatar(r.gender),
    },
    rels,
  };
}

function formatLifespan(p: InlawRelativeCard): string {
  if (p.birth_year && p.death_year) return `${p.birth_year}–${p.death_year}`;
  if (p.birth_year) return `sinh ${p.birth_year}`;
  if (p.death_year) return `mất ${p.death_year}`;
  if (!p.is_living) return "đã mất";
  return "";
}

function buildMiniTreeData(d: InlawPeerRelatives): F3Datum[] {
  const peerId = d.peer.id;
  const parentIds = d.parents.map((p) => p.id);
  const spouseIds = d.spouses.map((s) => s.id);
  const childIds = d.children.map((c) => c.id);

  // Per-spouse child grouping from RPC's other_parent_id field.
  const childrenBySpouse = new Map<string, string[]>();
  const peerOnlyChildren: string[] = [];
  for (const c of d.children) {
    if (c.other_parent_id && spouseIds.includes(c.other_parent_id)) {
      const arr = childrenBySpouse.get(c.other_parent_id) ?? [];
      arr.push(c.id);
      childrenBySpouse.set(c.other_parent_id, arr);
    } else {
      // No spouse recorded (single-parent family). Hang under peer
      // directly — family-chart will draw them with no second
      // parent line.
      peerOnlyChildren.push(c.id);
    }
  }

  const out: F3Datum[] = [];

  out.push(
    entryFor(d.peer, {
      parents: parentIds,
      spouses: spouseIds,
      children: childIds, // peer is always a parent of every child
    }),
  );

  for (const p of d.parents) {
    const otherParentId = parentIds.find((id) => id !== p.id);
    out.push(
      entryFor(p, {
        spouses: otherParentId ? [otherParentId] : [],
        children: [peerId],
      }),
    );
  }

  for (const s of d.spouses) {
    out.push(
      entryFor(s, {
        spouses: [peerId],
        // Each spouse only claims THEIR children, not peer's
        // children from other unions.
        children: childrenBySpouse.get(s.id) ?? [],
      }),
    );
  }

  for (const c of d.children) {
    out.push(
      entryFor(c, {
        // Anchor each child to (peer, that-child's-other-parent).
        // Single-parent children list only peer.
        parents:
          c.other_parent_id && spouseIds.includes(c.other_parent_id)
            ? [peerId, c.other_parent_id]
            : [peerId],
      }),
    );
  }
  // Suppress unused-var lint without removing the local — it stays
  // descriptive for the topology comment above.
  void peerOnlyChildren;

  return out;
}
