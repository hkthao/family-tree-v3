import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import {
  IconSearch,
  IconUser,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { computeKinship, type KinshipPerson } from "@/lib/kinship";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { matchesName } from "@/lib/unaccent";

const PICKER_CAP = 1000;

/**
 * "Máy tính xưng hô" — giờ là MỘT CHẾ ĐỘ của trang Danh bạ (nút gạt
 * "Danh bạ | Xưng hô"). `KinshipContent` là phần tái dùng nhúng vào
 * People.tsx. Chọn hai người → tính cách xưng hô theo truyền thống Việt.
 *
 * Deep-link ?a=&b= pre-fill hai ô chọn (nút "Xem xưng hô" ở PersonDetail).
 * Route cũ /kinship chuyển hướng sang /people?view=kinship (giữ link cũ).
 */
export function KinshipContent({
  clanId,
  userId,
}: {
  clanId: string;
  userId: string;
}) {
  const { clan } = useClanContext();
  const isMember = effectiveRole(clan) !== null;
  const [params, setParams] = useSearchParams();
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.kinshipIndex(clanId, userId),
    queryFn: () => getKinshipIndex(clanId),
    enabled: !!userId && isMember,
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

  if (!isMember) {
    return (
      <p className="text-sm text-muted-foreground">
        Bạn cần là thành viên dòng họ để tra cứu xưng hô.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Chọn hai người trong họ, app sẽ tính cách xưng hô theo truyền thống Việt —
        anh/em, chú/bác/cô/cậu/dì, anh em họ…
      </p>

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

/** Route cũ /kinship → chuyển sang chế độ xưng hô của trang Danh bạ. */
export default function Kinship() {
  const { clan } = useClanContext();
  return <Navigate to={`/clans/${clan.id}/people?view=kinship`} replace />;
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
        icon={<IconSearch />}
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
