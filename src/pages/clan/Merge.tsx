import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { IconCheck, IconSearch, IconX } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  findDuplicateCandidates,
  type DuplicateCandidate,
} from "@/lib/duplicateFinder";
import { queryKeys } from "@/lib/queries/keys";
import { mergePersons } from "@/lib/queries/merge";
import { getPerson, listPersons, type PersonDetail } from "@/lib/queries/persons";
import { getTreeData } from "@/lib/queries/tree";

export default function Merge() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [loserId, setLoserId] = useState<string | null>(null);

  // Auto-detect duplicate candidates from the existing tree-data query.
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });
  const candidates: DuplicateCandidate[] = tree
    ? findDuplicateCandidates(
        tree.persons.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          gender: p.gender,
          birth_date: p.birth_date,
          is_living: p.is_living,
          generation: p.generation,
        })),
      )
    : [];

  const { data: winner } = useQuery({
    queryKey: queryKeys.person(winnerId ?? "", userId),
    queryFn: () => getPerson(winnerId!),
    enabled: !!winnerId,
  });
  const { data: loser } = useQuery({
    queryKey: queryKeys.person(loserId ?? "", userId),
    queryFn: () => getPerson(loserId!),
    enabled: !!loserId,
  });

  const m = useMutation({
    mutationFn: () => mergePersons(winnerId!, loserId!),
    onSuccess: async (res) => {
      await invalidateClanData(qc, clan.id);
      toast.success("Đã gộp xong", {
        description: `Đã cập nhật ${res.familiesUpdated} gia đình, ${res.subsUpdated} đăng ký, ${res.eventsUpdated} sự kiện.`,
      });
      navigate(`/clans/${clan.id}/people/${winnerId}`);
    },
    onError: (e) =>
      toast.error("Không gộp được", { description: (e as Error).message }),
  });

  if (!canEditClan(clan)) {
    return <Navigate to={`/clans/${clan.id}/people`} replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Gộp người trùng</h2>
        <p className="text-muted-foreground mt-1">
          Chọn người <span className="font-medium">giữ lại</span> bên trái và
          người <span className="font-medium">gộp vào</span> bên phải. Mọi
          quan hệ (vợ/chồng, con, sự kiện) sẽ trỏ về người giữ lại; người
          còn lại bị xoá mềm (có thể khôi phục từ nhật ký).
        </p>
      </div>

      {candidates.length > 0 && (
        <SuggestionPanel
          candidates={candidates}
          onPick={(winner, loser) => {
            setWinnerId(winner);
            setLoserId(loser);
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PersonPicker
          clanId={clan.id}
          title="Giữ lại"
          person={winner ?? null}
          selectedId={winnerId}
          onSelect={setWinnerId}
          onClear={() => setWinnerId(null)}
          excludeId={loserId}
        />
        <PersonPicker
          clanId={clan.id}
          title="Gộp vào"
          person={loser ?? null}
          selectedId={loserId}
          onSelect={setLoserId}
          onClear={() => setLoserId(null)}
          excludeId={winnerId}
        />
      </div>

      {winner && loser && <Comparison winner={winner} loser={loser} />}

      {m.error && (
        <Alert variant="destructive">
          <AlertDescription>{(m.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          disabled={!winnerId || !loserId || m.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: `Gộp "${loser?.full_name}" vào "${winner?.full_name}"?`,
              description:
                "Quan hệ và trường còn trống của người giữ lại sẽ lấy từ người gộp vào. Người gộp vào sẽ bị xoá mềm — có thể khôi phục từ nhật ký.",
              confirmLabel: "Gộp",
            });
            if (ok) m.mutate();
          }}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          {m.isPending ? "Đang gộp…" : "Gộp"}
        </Button>
      </div>
    </div>
  );
}

// ─── Suggestion panel ─────────────────────────────────────────────

function SuggestionPanel({
  candidates,
  onPick,
}: {
  candidates: DuplicateCandidate[];
  onPick: (winnerId: string, loserId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? candidates : candidates.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đề xuất gộp</CardTitle>
        <CardDescription>
          Tìm thấy {candidates.length} cặp có thể trùng (theo tên + giới
          tính + năm sinh). Chọn người sống / có nhiều dữ liệu hơn làm
          "giữ lại".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border bg-card">
          {visible.map((c, i) => (
            <li key={i} className="px-3 py-2 flex flex-wrap items-center gap-3">
              <span
                className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  c.kind === "exact"
                    ? "bg-primary/15 text-primary"
                    : c.kind === "name"
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                }`}
                title={
                  c.kind === "exact"
                    ? "Trùng tên + năm sinh"
                    : c.kind === "name"
                      ? "Trùng tên"
                      : "Tên gần giống"
                }
              >
                {c.kind === "exact"
                  ? "tên + năm"
                  : c.kind === "name"
                    ? "tên"
                    : "gần giống"}
              </span>
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                <span className="truncate text-sm">
                  {c.a.full_name}
                  <span className="text-muted-foreground ml-1.5">
                    {personMeta(c.a)}
                  </span>
                </span>
                <span className="truncate text-sm">
                  {c.b.full_name}
                  <span className="text-muted-foreground ml-1.5">
                    {personMeta(c.b)}
                  </span>
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPick(c.a.id, c.b.id)}
              >
                Dùng cặp này
              </Button>
            </li>
          ))}
        </ul>
        {candidates.length > 5 && !showAll && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowAll(true)}
          >
            Xem thêm {candidates.length - 5} cặp
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function personMeta(p: DuplicateCandidate["a"]): string {
  const parts: string[] = [];
  if (p.birth_date) parts.push(`sinh ${p.birth_date.slice(0, 4)}`);
  if (p.generation !== null) parts.push(`Đời ${p.generation}`);
  if (!p.is_living) parts.push("đã mất");
  return parts.length > 0 ? `· ${parts.join(" · ")}` : "";
}

// ─── Person picker (search + result list) ─────────────────────────

function PersonPicker({
  clanId,
  title,
  person,
  selectedId,
  onSelect,
  onClear,
  excludeId,
}: {
  clanId: string;
  title: string;
  person: PersonDetail | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  excludeId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(h);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["merge-search", clanId, debounced],
    queryFn: () =>
      listPersons(clanId, {
        page: 1,
        pageSize: 10,
        search: debounced,
        sort: "name",
      }),
    enabled: debounced.length >= 2 && !selectedId,
    staleTime: 30 * 1000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {person
            ? "Bấm × để chọn lại."
            : "Gõ ít nhất 2 ký tự để tìm theo tên."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {person ? (
          <div className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{person.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {person.gender === "M" ? "Nam" : "Nữ"}
                {person.birth_date ? ` · sinh ${person.birth_date.slice(0, 4)}` : ""}
                {person.generation !== null ? ` · Đời ${person.generation}` : ""}
                {!person.is_living ? " · đã mất" : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onClear}>
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tên người…"
                className="pl-9"
              />
            </div>
            {data && data.rows.length > 0 && (
              <ul className="divide-y rounded-md border bg-card max-h-72 overflow-y-auto">
                {data.rows
                  .filter((p) => p.id !== excludeId)
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(p.id)}
                        className="w-full text-left px-3 py-2 hover:bg-muted/40"
                      >
                        <p className="font-medium truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.gender === "M" ? "Nam" : "Nữ"}
                          {p.birth_date ? ` · sinh ${p.birth_date.slice(0, 4)}` : ""}
                          {p.generation !== null ? ` · Đời ${p.generation}` : ""}
                          {!p.is_living ? " · đã mất" : ""}
                        </p>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {debounced.length >= 2 && data && data.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Không tìm thấy ai khớp.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Comparison panel ──────────────────────────────────────────────

function Comparison({
  winner,
  loser,
}: {
  winner: PersonDetail;
  loser: PersonDetail;
}) {
  const rows: { label: string; w: string | null; l: string | null }[] = [
    { label: "Họ và tên", w: winner.full_name, l: loser.full_name },
    {
      label: "Giới tính",
      w: winner.gender === "M" ? "Nam" : "Nữ",
      l: loser.gender === "M" ? "Nam" : "Nữ",
    },
    {
      label: "Ngày sinh",
      w: winner.birth_date,
      l: loser.birth_date,
    },
    {
      label: "Ngày mất",
      w: winner.death_date,
      l: loser.death_date,
    },
    { label: "Tên tự", w: winner.courtesy_name, l: loser.courtesy_name },
    { label: "Tên húy", w: winner.nickname, l: loser.nickname },
    { label: "Tên thụy", w: winner.posthumous_name, l: loser.posthumous_name },
    { label: "Nơi sinh", w: winner.birth_place, l: loser.birth_place },
    { label: "Nơi an táng", w: winner.burial_place, l: loser.burial_place },
    { label: "Tiểu sử", w: winner.bio, l: loser.bio },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>So sánh dữ liệu</CardTitle>
        <CardDescription>
          Mỗi trường còn trống bên trái sẽ được lấp từ bên phải. Trường có
          giá trị ở cả hai bên thì giữ giá trị bên trái — chỉnh sửa sau khi
          gộp nếu cần.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 font-medium text-muted-foreground">
                  Trường
                </th>
                <th className="py-2 pr-3 font-medium">Giữ lại</th>
                <th className="py-2 font-medium">Gộp vào</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const conflict =
                  !!r.w && !!r.l && r.w !== r.l && r.label !== "Họ và tên";
                const willFill = !r.w && !!r.l;
                return (
                  <tr key={r.label} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r.label}
                    </td>
                    <td className="py-2 pr-3">
                      {r.w || (
                        <span className="text-muted-foreground italic">
                          (trống)
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2 ${
                        conflict
                          ? "text-destructive"
                          : willFill
                            ? "text-primary"
                            : ""
                      }`}
                    >
                      {r.l || (
                        <span className="text-muted-foreground italic">
                          (trống)
                        </span>
                      )}
                      {willFill && (
                        <span className="ml-2 text-xs text-primary">
                          → sẽ lấp
                        </span>
                      )}
                      {conflict && (
                        <span className="ml-2 text-xs text-destructive">
                          ≠ xung đột
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
