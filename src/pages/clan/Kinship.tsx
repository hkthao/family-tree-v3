import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHelpVideo } from "@/components/PageHelpVideo";
import { IconUser, IconUsers } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { computeKinship, type KinshipPerson } from "@/lib/kinship";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { matchesName } from "@/lib/unaccent";

const PICKER_CAP = 1000;

/**
 * /clans/:id/kinship — "máy tính xưng hô".
 *
 * Two person pickers + a result panel showing what each calls the
 * other in Vietnamese kinship terms. Loads the full clan person +
 * family graph once (the same payload as the Tree / Danh bạ pages
 * already use, so it should already be in the TanStack cache).
 *
 * Deep-link: ?a=<personId>&b=<personId> pre-fills the pickers — used
 * by the "Xem xưng hô" button on PersonDetail.
 */
export default function Kinship() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [params, setParams] = useSearchParams();
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";

  // Máy tính xưng hô needs the full person + family graph, which
  // raw RLS hides from non-members. Could be supported via the
  // masked views, but the use case ("what should I call this
  // distant uncle") is fundamentally a member-of-the-family feature.
  // Redirect non-member visitors back to the public surface.
  if (effectiveRole(clan) === null) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.kinshipIndex(clan.id, userId),
    queryFn: () => getKinshipIndex(clan.id),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  function setPick(slot: "a" | "b", id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set(slot, id);
    else next.delete(slot);
    setParams(next, { replace: true });
  }

  const result = useMemo(() => {
    if (!data || !aId || !bId) return null;
    return computeKinship(aId, bId, data.byId);
  }, [data, aId, bId]);

  const personA = aId ? data?.byId.get(aId) ?? null : null;
  const personB = bId ? data?.byId.get(bId) ?? null : null;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Tra cứu xưng hô" },
        ]}
      />

      <header className="flex items-start gap-3">
        <IconUsers className="h-7 w-7 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="clan-name text-xl sm:text-2xl font-semibold leading-tight">
            Tra cứu xưng hô
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chọn hai người trong họ, app sẽ tính cách xưng hô theo truyền
            thống Việt — anh/em ruột, chú/bác/cô/cậu/dì, anh em họ…
          </p>
          <div className="mt-1">
            <PageHelpVideo size="text" />
          </div>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải danh bạ…</p>}

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <PersonPicker
            label="Người A"
            persons={data.ordered}
            value={aId}
            onChange={(id) => setPick("a", id)}
          />
          <PersonPicker
            label="Người B"
            persons={data.ordered}
            value={bId}
            onChange={(id) => setPick("b", id)}
          />
        </div>
      )}

      {result && personA && personB && (
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="text-lg font-semibold">Kết quả</h2>

          {result.kind === "same" ? (
            <p className="text-muted-foreground">Cùng một người.</p>
          ) : result.kind === "unrelated" ? (
            <Alert>
              <AlertDescription>{result.reason}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <RelationCard
                  fromName={personA.full_name}
                  toName={personB.full_name}
                  label={result.aCallsB}
                />
                <RelationCard
                  fromName={personB.full_name}
                  toName={personA.full_name}
                  label={result.bCallsA}
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                Lý do: {result.reason}
              </p>
            </>
          )}
        </section>
      )}

      {data && (!aId || !bId) && (
        <p className="text-sm text-muted-foreground">
          Chọn đủ hai người để xem kết quả.
        </p>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function PersonPicker({
  label,
  persons,
  value,
  onChange,
}: {
  label: string;
  persons: KinshipPerson[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const { filtered, totalMatched } = useMemo(() => {
    const matched = filter.trim()
      ? persons.filter((p) => matchesName(p.full_name, filter))
      : persons;
    return { filtered: matched.slice(0, PICKER_CAP), totalMatched: matched.length };
  }, [filter, persons]);
  const selected = value ? persons.find((p) => p.id === value) ?? null : null;

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {selected && (
        <div className="flex items-center gap-2 text-sm">
          <IconUser className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{selected.full_name}</span>
          {selected.birth_year && (
            <span className="text-muted-foreground">
              ({selected.birth_year})
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Bỏ chọn
          </button>
        </div>
      )}
      <Input
        data-testid={`kinship-picker-${label === "Người A" ? "a" : "b"}-input`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={selected ? "Đổi người…" : "Tìm theo tên (không cần dấu)"}
      />
      {totalMatched > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalMatched > PICKER_CAP
            ? `Hiện ${PICKER_CAP} / ${totalMatched} kết quả — gõ thêm để thu hẹp.`
            : `Hiện ${totalMatched} kết quả.`}
        </p>
      )}
      <ul className="max-h-64 overflow-y-auto border rounded-md divide-y text-sm">
        {filtered.length === 0 && (
          <li className="px-2 py-2 text-muted-foreground italic">
            Không có kết quả.
          </li>
        )}
        {filtered.map((p) => {
          const active = p.id === value;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(p.id)}
                className={`w-full text-left px-2 py-1.5 hover:bg-muted/50 ${
                  active ? "bg-primary/10 text-primary font-medium" : ""
                }`}
              >
                {p.full_name}
                {p.birth_year && (
                  <span className="text-muted-foreground ml-2">
                    ({p.birth_year})
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RelationCard({
  fromName,
  toName,
  label,
}: {
  fromName: string;
  toName: string;
  label: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{fromName}</span> gọi{" "}
        <span className="font-medium text-foreground">{toName}</span> là
      </p>
      <p className="clan-name text-2xl font-semibold text-primary mt-1">
        {label}
      </p>
    </div>
  );
}
