import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toast";
import { IconCheck, IconPencil, IconUsers } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { toFamilyChart } from "@/lib/familyChartAdapter";
import {
  traceLineage,
  type LineageVia,
} from "@/lib/lineage";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { queryKeys } from "@/lib/queries/keys";
import { listClanMembers, setMySelfPerson } from "@/lib/queries/members";
import { getTreeData } from "@/lib/queries/tree";
import { unaccent } from "@/lib/unaccent";

import "family-chart/styles/family-chart.css";

/**
 * Direct lineage page. Two modes:
 *
 *   1. Not yet linked → ChoosePersonView lets the user search the
 *      clan and claim a person as "me". Goes through the RPC so RLS
 *      stays admin-only on raw clan_members updates.
 *   2. Linked → LineageView shows the cards from thuỷ tổ down to self
 *      (Vietnamese convention: older at top). Each fork point (where
 *      the child has both parents recorded) gets a paternal/maternal
 *      toggle next to the parent card.
 */
export default function MyLineage() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  if (effectiveRole(clan) === null) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  const { data: members } = useQuery({
    queryKey: queryKeys.clanMembers(clan.id, userId),
    queryFn: () => listClanMembers(clan.id),
    enabled: !!userId,
  });
  const myMember = members?.find((m) => m.user_id === userId);

  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Đường trực hệ" },
        ]}
      />

      <PageHeader
        icon={<IconUsers className="h-7 w-7" />}
        title="Đường trực hệ"
        description="Từ tôi về thuỷ tổ — mặc định đi theo bên nội, có thể đổi sang bên ngoại ở từng đời."
      />

      {!myMember?.self_person_id && tree && (
        <ChoosePersonView
          clanId={clan.id}
          userId={userId}
          persons={tree.persons}
        />
      )}

      {myMember?.self_person_id && tree && (
        <LineageView
          clanId={clan.id}
          userId={userId}
          selfPersonId={myMember.self_person_id}
          tree={tree}
          verified={myMember.self_person_verified}
        />
      )}

      {treeLoading && (
        <p className="text-muted-foreground">Đang tải gia phả…</p>
      )}
    </div>
  );
}

// ─── Choose-person view ─────────────────────────────────────────

function ChoosePersonView({
  clanId,
  userId,
  persons,
}: {
  clanId: string;
  userId: string;
  persons: Array<{
    id: string;
    full_name: string;
    gender: "M" | "F";
    is_living: boolean;
    birth_date: string | null;
    death_date: string | null;
    generation: number | null;
  }>;
}) {
  const { clan } = useClanContext();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");

  const setSelfM = useMutation({
    mutationFn: (personId: string) => setMySelfPerson(clanId, personId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clanMembers(clanId, userId) });
      toast.success("Đã chọn — chờ admin xác nhận");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const matches = useMemo(() => {
    const term = search.trim();
    if (!term) return [];
    const needle = unaccent(term);
    return persons
      .filter((p) => unaccent(p.full_name).includes(needle))
      .slice(0, 10);
  }, [persons, search]);

  return (
    <div className="rounded-lg border bg-card py-8 sm:py-10 px-6">
      <div
        aria-hidden="true"
        className="mx-auto h-20 w-20 rounded-full bg-muted/40 inline-flex items-center justify-center text-muted-foreground"
      >
        <IconUsers className="h-12 w-12" />
      </div>
      <h3 className="clan-name text-xl font-semibold text-primary text-center mt-4">
        Bạn là ai trong gia phả này?
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mx-auto mt-1.5">
        Tìm và chọn người đại diện cho mình. Admin sẽ xác nhận trước
        khi hiển thị công khai.
      </p>
      <div className="mt-5 mx-auto max-w-md w-full space-y-3">
        <SearchInput
          label="Tìm theo tên"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Gõ tên của bạn trong gia phả…"
        />
        {matches.length > 0 && (
          <ul className="rounded-md border bg-background divide-y overflow-hidden text-left">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelfM.mutate(p.id)}
                  disabled={setSelfM.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 disabled:opacity-50"
                >
                  <PersonAvatar
                    gender={p.gender}
                    photoUrl={null}
                    size={40}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-medium truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.gender === "M" ? "Nam" : "Nữ"}
                      {p.generation !== null &&
                        ` · Đời ${p.generation - clan.generation_offset}`}
                      {p.is_living && p.birth_date
                        ? ` · sinh ${p.birth_date.slice(0, 4)}`
                        : !p.is_living && p.death_date
                          ? ` · đã mất ${p.death_date.slice(0, 4)}`
                          : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {search.trim() && matches.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Không có ai khớp tên này.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Lineage view ────────────────────────────────────────────────

interface TreeShape {
  persons: Array<{
    id: string;
    full_name: string;
    gender: "M" | "F";
    is_living: boolean;
    is_root: boolean;
    generation: number | null;
    birth_family_id: string | null;
    birth_date: string | null;
    death_date: string | null;
    photo_path: string | null;
  }>;
  families: Array<{ id: string; husband_id: string | null; wife_id: string | null }>;
}

// ─── family-chart bootstrap types ────────────────────────────────
// Mirrors the minimal subset of family-chart we use here. Same shape
// as Tree.tsx — the lineage view is just a filtered slice through
// the same renderer.

interface F3Chart {
  setCardYSpacing: (n: number) => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setTransitionTime: (n: number) => F3Chart;
  setSingleParentEmptyCard: (b: boolean) => F3Chart;
  updateTree: (opts: { initial?: boolean }) => void;
  updateMainId?: (id: string) => void;
  setCardSvg?: () => F3Card;
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

function LineageView({
  clanId,
  userId,
  selfPersonId,
  tree,
  verified,
}: {
  clanId: string;
  userId: string;
  selfPersonId: string;
  tree: TreeShape;
  verified: boolean;
}) {
  const { clan } = useClanContext();
  const qc = useQueryClient();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3Chart | null>(null);
  // Per-child override keyed by the child's id. The toggle for "Đời N"
  // controls how the walk UP from displaySteps[i+1] (the child closer
  // to self) proceeds — so the key stored here is that child's id.
  const [choices, setChoices] = useState<Record<string, LineageVia>>({});

  const lineage = useMemo(
    () => traceLineage(tree.persons, tree.families, selfPersonId, choices),
    [tree, selfPersonId, choices],
  );

  const clearSelfM = useMutation({
    mutationFn: () => setMySelfPerson(clanId, null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clanMembers(clanId, userId) });
      toast.success("Đã bỏ chọn người đại diện");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  // Batch-resolve signed URLs for every uploaded photo on the lineage
  // chain. Keyed by sorted paths so re-renders share the cache.
  const lineagePhotoPaths = useMemo(
    () =>
      [
        ...new Set(
          lineage.steps
            .map((s) => s.person.photo_path)
            .filter((p): p is string => !!p),
        ),
      ].sort(),
    [lineage],
  );
  const { data: photoUrls } = useQuery({
    queryKey: ["signed-photos-batch", clanId, "lineage", lineagePhotoPaths],
    queryFn: () => getSignedPhotoUrlMap(lineagePhotoPaths),
    enabled: lineagePhotoPaths.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Build a filtered slice of (persons, families) representing only
  // the direct line: each step's person, and one synthetic family per
  // gap connecting child to chosen parent. Other rels (spouses,
  // siblings) are scrubbed so family-chart renders a clean chain.
  const f3Data = useMemo(() => {
    if (lineage.steps.length === 0) return null;
    const persons = lineage.steps.map((s) => ({
      id: s.person.id,
      full_name: s.person.full_name,
      gender: s.person.gender,
      is_living: s.person.is_living,
      is_root: s.person.is_root,
      generation: s.person.generation,
      birth_family_id: s.person.birth_family_id,
      birth_date: s.person.birth_date,
      death_date: s.person.death_date,
      branch_id: null as string | null,
      photo_path: s.person.photo_path,
    }));
    const families: Array<{
      id: string;
      husband_id: string | null;
      wife_id: string | null;
      spouse_order: number | null;
      created_at: string | null;
    }> = [];
    for (let i = 0; i < lineage.steps.length - 1; i++) {
      const child = lineage.steps[i].person;
      const parent = lineage.steps[i + 1];
      if (!child.birth_family_id) continue;
      families.push({
        id: child.birth_family_id,
        husband_id: parent.arrivedVia === "father" ? parent.person.id : null,
        wife_id: parent.arrivedVia === "mother" ? parent.person.id : null,
        // Single-chain lineage — no co-spouses to rank.
        spouse_order: null,
        created_at: null,
      });
    }
    return toFamilyChart(persons, families, photoUrls);
  }, [lineage, photoUrls]);

  // Build / rebuild the chart whenever the filtered slice changes
  // (initial mount or choices toggled).
  useEffect(() => {
    if (!containerRef.current || !f3Data) return;
    let disposed = false;
    const node = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;

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

        const card = (built as F3Chart & {
          setCardSvg?: () => F3Card;
        }).setCardSvg?.();

        const lifespan = (d: DatumNode): string => {
          const f = d.data ?? {};
          const b = (f["birthday"] as string) || "?";
          const isLiving = f["is_living"] !== false;
          const death = (f["death_year"] as string) || (isLiving ? "" : "?");
          return death ? `${b} - ${death}` : b;
        };

        card
          ?.setCardDisplay([
            (d) => String((d as DatumNode).data?.["full name"] ?? ""),
            (d) => lifespan(d as DatumNode),
          ])
          .setCardDim({
            w: 220,
            h: 64,
            text_x: 64,
            text_y: 18,
            img_w: 50,
            img_h: 50,
            img_x: 8,
            img_y: 7,
          })
          .setOnCardUpdate(function (d) {
            const datum = d.data as DatumNode | undefined;
            const fields = datum?.data ?? {};
            const personId = datum?.id;
            const tspans = this.querySelectorAll<SVGTSpanElement>(
              ".card-text text tspan",
            );
            const meta = tspans[1];
            if (meta) {
              meta.setAttribute("text-anchor", "start");
              meta.setAttribute("x", "0");
              meta.setAttribute("dy", "18");
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
                <rect x="172" y="6" width="42" height="18" rx="9"
                      fill="#7A2E2E" />
                <text x="193" y="19" text-anchor="middle"
                      fill="#FFFFFF" font-size="10" font-weight="700">
                  Đời ${gen - clan.generation_offset}
                </text>`;
              this.querySelector(".card-body")?.appendChild(badge);
            }
            // Make each card clickable → person detail. No edit/add
            // affordances here; lineage is a read-only navigator.
            if (personId) {
              this.style.cursor = "pointer";
              this.onclick = () => {
                window.location.href = `/clans/${clanId}/people/${personId}`;
              };
            }
          });

        built.setTransitionTime(200);
        built.setOrientationVertical?.();
        built.setCardXSpacing(250).setCardYSpacing(132);
        // Suppress the "ghost" empty card slot family-chart draws when
        // only one parent is on a family — our synthetic families have
        // exactly one parent each by design.
        built.setSingleParentEmptyCard(false);
        // Anchor on the self person so the camera sits at the bottom
        // and ancestors stack above.
        if (built.updateMainId) built.updateMainId(selfPersonId);

        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (disposed) return;
        built.updateTree({ initial: true });
        chartRef.current = built;

        if (typeof ResizeObserver !== "undefined") {
          let last = node.getBoundingClientRect().width;
          resizeObserver = new ResizeObserver(() => {
            const next = node.getBoundingClientRect().width;
            if (Math.abs(next - last) < 1) return;
            last = next;
            chartRef.current?.updateTree({ initial: false });
          });
          resizeObserver.observe(node);
        }
      } catch (e) {
        console.error("lineage chart init failed", e);
      }
    })();

    return () => {
      disposed = true;
      chartRef.current = null;
      resizeObserver?.disconnect();
      node.innerHTML = "";
    };
  }, [f3Data, selfPersonId, clanId, clan.generation_offset]);

  // For the toolbar fork toggles. lineage.steps order is [self, ...,
  // root]. A fork exists at step i (0 ≤ i < len-1) iff the child at
  // step i had both parents recorded. The toggle controls which
  // parent we walked up to → that's the arrivedVia of step i+1.
  const forks = lineage.steps
    .map((s, i) => ({ child: s.person, parentStep: lineage.steps[i + 1] }))
    .filter((f) => f.parentStep?.bothParentsAvailable === true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            {lineage.steps.length === 1
              ? "Chưa có thông tin tổ tiên trong gia phả."
              : lineage.reachedRoot
                ? `Lên đến thuỷ tổ (${lineage.steps.length} đời)`
                : `${lineage.steps.length} đời — chưa đến thuỷ tổ`}
          </span>
          {verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <IconCheck className="h-3.5 w-3.5" />
              Admin đã xác nhận
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Chờ admin xác nhận
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clearSelfM.mutate()}
          disabled={clearSelfM.isPending}
        >
          <IconPencil className="h-4 w-4 mr-1.5" />
          Đổi người
        </Button>
      </div>

      {lineage.steps.length === 1 && (
        <Alert>
          <AlertDescription>
            Người bạn chọn chưa có cha/mẹ trong gia phả. Khi admin bổ
            sung thêm thế hệ trên, đường trực hệ sẽ tự kéo dài.
          </AlertDescription>
        </Alert>
      )}

      {forks.length > 0 && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Có {forks.length} điểm rẽ.{" "}
            <span className="text-foreground">Bên nội</span> = họ cha ·{" "}
            <span className="text-foreground">Bên ngoại</span> = họ mẹ.
          </p>
          <div className="flex flex-wrap gap-2">
            {forks.map((f) => {
              const current: LineageVia =
                choices[f.child.id] ??
                (f.parentStep.arrivedVia === "mother" ? "maternal" : "paternal");
              return (
                <div
                  key={f.child.id}
                  className="inline-flex items-center gap-2 rounded-md border bg-background pl-3 pr-1 py-1"
                >
                  <span className="text-xs text-muted-foreground">
                    {f.child.full_name}
                    {f.child.generation !== null
                      ? ` (Đời ${f.child.generation - clan.generation_offset})`
                      : ""}
                    :
                  </span>
                  <div
                    className="inline-flex rounded-md overflow-hidden"
                    role="group"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setChoices((prev) => ({
                          ...prev,
                          [f.child.id]: "paternal",
                        }))
                      }
                      aria-pressed={current === "paternal"}
                      className={`px-2.5 h-7 text-xs ${
                        current === "paternal"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      Bên nội
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setChoices((prev) => ({
                          ...prev,
                          [f.child.id]: "maternal",
                        }))
                      }
                      aria-pressed={current === "maternal"}
                      className={`px-2.5 h-7 text-xs border-l ${
                        current === "maternal"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      Bên ngoại
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="f3 rounded-md border bg-card text-foreground"
        style={
          {
            height: "calc(100dvh - 320px)",
            minHeight: "420px",
            "--male-color": "var(--tree-card-male)",
            "--female-color": "var(--tree-card-female)",
          } as React.CSSProperties
        }
        aria-label="Đường trực hệ (chỉ xem)"
      />
    </div>
  );
}
