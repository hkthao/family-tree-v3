import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconPencil,
  IconUsers,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import {
  traceLineage,
  type LineageStep,
  type LineageVia,
} from "@/lib/lineage";
import { queryKeys } from "@/lib/queries/keys";
import { listClanMembers, setMySelfPerson } from "@/lib/queries/members";
import { getTreeData } from "@/lib/queries/tree";
import { unaccent } from "@/lib/unaccent";

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
      <nav>
        <BackLink fallback={`/clans/${clan.id}`} />
      </nav>

      <header className="flex items-start gap-3">
        <IconUsers className="h-7 w-7 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="clan-name text-xl sm:text-2xl font-semibold leading-tight">
            Đường trực hệ
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Từ tôi về thuỷ tổ — theo dòng cha (mặc định), có thể đổi
            sang dòng mẹ ở từng đời.
          </p>
        </div>
      </header>

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
                      {p.generation !== null && ` · Đời ${p.generation}`}
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
  const qc = useQueryClient();
  const toast = useToast();
  // Per-child override: when set, walk via the chosen parent of that
  // child instead of the default 'paternal'.
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

  // Display order: thuỷ tổ at the top, self at the bottom — matches
  // how Vietnamese gia phả are read.
  const displaySteps = [...lineage.steps].reverse();

  return (
    <div className="space-y-5">
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

      <ol className="relative space-y-0">
        {displaySteps.map((step, idx) => {
          // The vertical connector belongs to every card EXCEPT the
          // very last (bottom = self). We render the connector below
          // each card so each iteration is self-contained.
          const isLast = idx === displaySteps.length - 1;
          // The "child" of this step (one generation below) is the
          // step at idx+1 in displaySteps; its arrivedVia + presence of
          // both parents drives the fork toggle on this step.
          const childStep = displaySteps[idx + 1];
          const showForkToggle =
            childStep?.bothParentsAvailable === true && !isLast;
          return (
            <LineageCard
              key={step.person.id}
              step={step}
              clanId={clanId}
              isFirst={idx === 0}
              isLast={isLast}
              showForkToggle={showForkToggle}
              currentVia={
                childStep
                  ? choices[childStep.person.id === step.person.id
                      ? step.person.id
                      : childStep.person.id] ?? (childStep.arrivedVia === "mother"
                      ? "maternal"
                      : "paternal")
                  : "paternal"
              }
              onToggleVia={(via) => {
                // The choice is keyed by the CHILD's id (the person
                // whose birth_family we'll re-walk).
                if (!childStep) return;
                const childId = childStep.person.id;
                // Wait — child is the one we DESCEND from. The toggle
                // controls how we WALK UP from the child. So the key
                // in choices is the child below, whose birth_family
                // points to the parent above. childStep is the parent
                // (idx+1 in display = idx-1 in lineage order from
                // top-down). Let me re-derive.
                // displaySteps reverses lineage.steps, so:
                //   displaySteps[idx]   = ancestor at higher gen
                //   displaySteps[idx+1] = the child (closer to self)
                // The choices map uses the CHILD's id, which is
                // displaySteps[idx+1].person.id.
                setChoices((prev) => ({ ...prev, [childId]: via }));
              }}
            />
          );
        })}
      </ol>
    </div>
  );
}

function LineageCard({
  step,
  clanId,
  isFirst,
  isLast,
  showForkToggle,
  currentVia,
  onToggleVia,
}: {
  step: LineageStep;
  clanId: string;
  isFirst: boolean;
  isLast: boolean;
  showForkToggle: boolean;
  currentVia: LineageVia;
  onToggleVia: (via: LineageVia) => void;
}) {
  const p = step.person;
  const lifespan = formatLifespan(p);
  const subtitleParts = [
    p.is_root ? "Thuỷ tổ" : null,
    p.generation !== null ? `Đời ${p.generation}` : null,
    lifespan,
    step.arrivedVia === "father"
      ? "qua dòng cha"
      : step.arrivedVia === "mother"
        ? "qua dòng mẹ"
        : null,
  ].filter(Boolean);

  return (
    <li className="relative">
      {/* Vertical connector below this card. Hidden on the last card
          (self). Drawn as a 2px line in the muted-foreground tone. */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[31px] top-[72px] bottom-0 w-px bg-border"
        />
      )}
      <div className="flex items-start gap-3 py-3">
        <Link
          to={`/clans/${clanId}/people/${p.id}`}
          className="shrink-0"
          aria-label={`Mở trang ${p.full_name}`}
        >
          <PersonAvatar
            gender={p.gender}
            photoUrl={null}
            size={64}
            className={
              isFirst
                ? "ring-2 ring-accent ring-offset-2 ring-offset-background"
                : isLast
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : undefined
            }
          />
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <Link
            to={`/clans/${clanId}/people/${p.id}`}
            className="font-semibold text-base hover:text-primary truncate block"
          >
            {p.full_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {subtitleParts.join(" · ")}
          </p>
          {showForkToggle && (
            <div
              className="inline-flex rounded-md border bg-card overflow-hidden mt-2"
              role="group"
              aria-label="Đổi dòng lên đời trên"
            >
              <button
                type="button"
                onClick={() => onToggleVia("paternal")}
                aria-pressed={currentVia === "paternal"}
                className={`px-2.5 h-8 text-xs ${
                  currentVia === "paternal"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                Dòng cha
              </button>
              <button
                type="button"
                onClick={() => onToggleVia("maternal")}
                aria-pressed={currentVia === "maternal"}
                className={`px-2.5 h-8 text-xs border-l ${
                  currentVia === "maternal"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                Dòng mẹ
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function formatLifespan(p: {
  is_living: boolean;
  birth_date: string | null;
  death_date: string | null;
}): string | null {
  const b = p.birth_date?.slice(0, 4);
  const d = p.death_date?.slice(0, 4);
  if (p.is_living) return b ? `${b} —` : null;
  if (!b && !d) return null;
  return `${b ?? "?"} — ${d ?? "?"}`;
}
