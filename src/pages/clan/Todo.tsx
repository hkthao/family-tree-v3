import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { QuickDateFixSheet } from "@/components/QuickDateFixSheet";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconScroll,
  IconX,
} from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import {
  getClanCompletion,
  getClanTodoItems,
  getClanTodoSummary,
  setPersonTodoExcluded,
  TODO_CATEGORIES,
  type TodoCategory,
  type TodoItemRow,
  type TodoSummaryRow,
} from "@/lib/queries/todo";

const PAGE_SIZE = 50;

const CATEGORY_META: Record<
  TodoCategory,
  { label: string; description: string }
> = {
  missing_parents: {
    label: "Thiếu cha/mẹ",
    description:
      "Người chưa có bố/mẹ trong cây — bổ sung để gắn vào đúng đời và nhánh.",
  },
  missing_dates: {
    label: "Thiếu năm sinh/mất",
    description:
      "Không có cả dương lẫn âm lịch năm sinh, hoặc đã mất mà chưa biết năm mất/giỗ.",
  },
  dead_end: {
    label: "Nhánh nghi sót",
    description:
      "Đã có vợ/chồng và đủ tuổi (30+) nhưng chưa ghi con — nhiều khả năng còn thiếu.",
  },
  missing_media: {
    label: "Thiếu ảnh / âm lịch",
    description:
      "Người chưa có ảnh, hoặc đã có ngày dương nhưng chưa quy đổi âm lịch.",
  },
};

const MISSING_LABEL: Record<string, string> = {
  parents: "thiếu cha/mẹ",
  birth_year: "thiếu năm sinh",
  death_year: "thiếu năm mất",
  dead_end: "chưa ghi con",
  photo: "thiếu ảnh",
  birth_lunar: "thiếu âm lịch ngày sinh",
  death_lunar: "thiếu âm lịch ngày mất",
};

/**
 * /clans/:id/todo — gap-detection board.
 *
 * Visible to all clan members. The action when a row is clicked
 * depends on the viewer:
 *   - Admin/editor → /people/:id/edit (fix directly).
 *   - Member       → /people/:id     (read context + open ContributeDialog).
 *
 * Counts come from get_clan_todo_summary; items pull paginated rows
 * via get_clan_todo_items.
 */
export default function Todo() {
  const navigate = useNavigate();
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  // Việc cần làm is a member-only feature: the underlying RPCs all
  // raise 42501 for non-members (they explicitly check is_clan_member),
  // and the whole point of the page — surfacing gaps you can fix — is
  // moot for someone who can't edit the clan. Redirect them back to
  // the public view rather than show a broken page full of 403s.
  if (effectiveRole(clan) === null) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  // Bulk-select state, reset whenever the user switches categories or
  // pages — selecting "Ông A" on `missing_dates` shouldn't survive a
  // jump to `missing_parents`, even if the same row would appear there.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function invalidateTodoQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanTodoSummary(clan.id, userId),
      }),
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "clan-todo-items" &&
          q.queryKey[1] === clan.id,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanTodoCount(clan.id, userId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanCompletion(clan.id, userId),
      }),
    ]);
  }

  const excludeMutation = useMutation({
    mutationFn: (personId: string) => setPersonTodoExcluded(personId, true),
    onSuccess: async () => {
      await invalidateTodoQueries();
      toast.success("Đã loại khỏi danh sách");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  // Sequential rather than Promise.all — Supabase rate-limits the RPC
  // path and a 50-row burst would round-trip 50× anyway. The toast at
  // the end is the user-visible signal; intermediate state stays inside
  // the mutation.
  const bulkExcludeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await setPersonTodoExcluded(id, true);
      }
      return ids.length;
    },
    onSuccess: async (count) => {
      setSelected(new Set());
      await invalidateTodoQueries();
      toast.success(`Đã loại ${count} người khỏi danh sách`);
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  async function onBulkExclude() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Loại ${ids.length} người khỏi danh sách?`,
      description:
        "Họ sẽ không hiện trong Việc cần làm nữa và không tính vào % hoàn thành. Có thể đổi lại từng người ở trang sửa.",
      confirmLabel: "Loại",
      destructive: true,
    });
    if (ok) bulkExcludeMutation.mutate(ids);
  }

  const [category, setCategory] = useState<TodoCategory>("missing_parents");
  // 1-based for consistency with Audit/Clans/People pagination.
  const [page, setPage] = useState(1);

  // Clear bulk selection on category / page change — a row only
  // exists on one (category, page) tuple, so carrying selection over
  // would invisibly target rows the user can no longer see.
  useEffect(() => {
    setSelected(new Set());
  }, [category, page]);

  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: queryKeys.clanTodoSummary(clan.id, userId),
    queryFn: () => getClanTodoSummary(clan.id),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: completion } = useQuery({
    queryKey: queryKeys.clanCompletion(clan.id, userId),
    queryFn: () => getClanCompletion(clan.id),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const countByCategory = useMemo(() => {
    const m = new Map<TodoCategory, number>();
    (summary ?? []).forEach((r: TodoSummaryRow) => m.set(r.category, r.count));
    return m;
  }, [summary]);

  const totalForCategory = countByCategory.get(category) ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalForCategory / PAGE_SIZE));
  // Clamp the requested page against current totals so a stale page
  // index (e.g. after switching tabs or items disappearing under us)
  // re-queries the last valid page instead of returning an empty slice.
  const safePage = Math.min(page, totalPages);

  const {
    data: rows,
    error: itemsError,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
  } = useQuery({
    queryKey: queryKeys.clanTodoItems(clan.id, userId, category, safePage),
    queryFn: () =>
      getClanTodoItems(
        clan.id,
        category,
        PAGE_SIZE,
        (safePage - 1) * PAGE_SIZE,
      ),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const startIdx = totalForCategory === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(totalForCategory, safePage * PAGE_SIZE);

  // Inline quick-fix sheets — open the right primitive depending on
  // which category the row belongs to. Cuts the navigate-edit-save-
  // navigate-back loop down to one tap. Categories that need more
  // context than a single field can hold (dead_end / media) still
  // navigate.
  const [quickDateFix, setQuickDateFix] = useState<TodoItemRow | null>(null);
  const [quickParentFix, setQuickParentFix] = useState<TodoItemRow | null>(
    null,
  );

  function openItem(item: TodoItemRow) {
    if (canEdit && category === "missing_dates") {
      setQuickDateFix(item);
      return;
    }
    if (canEdit && category === "missing_parents") {
      setQuickParentFix(item);
      return;
    }
    const path = canEdit
      ? `/clans/${clan.id}/people/${item.person_id}/edit`
      : `/clans/${clan.id}/people/${item.person_id}`;
    navigate(path);
  }

  const totalLoadBearing =
    (countByCategory.get("missing_parents") ?? 0) +
    (countByCategory.get("missing_dates") ?? 0) +
    (countByCategory.get("dead_end") ?? 0);

  return (
    <div className="space-y-5">
      <nav>
        <BackLink fallback={`/clans/${clan.id}`} />
      </nav>

      <header className="flex items-start gap-3">
        <IconScroll className="h-7 w-7 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="clan-name text-xl sm:text-2xl font-semibold leading-tight">
            Việc cần làm
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            App tự dò chỗ thiếu trong gia phả — cả họ cùng bổ sung. Bấm
            vào một người để {canEdit ? "sửa thẳng." : "đề xuất bổ sung."}
          </p>
          {summary && (
            <p className="text-xs text-muted-foreground mt-1">
              Tổng {totalLoadBearing.toLocaleString("vi-VN")} mục cần xử
              lý trong họ.
            </p>
          )}
        </div>
      </header>

      {completion && completion.total > 0 && completion.percent !== null && (
        <CompletionProgress completion={completion} />
      )}

      {summaryError && (
        <Alert variant="destructive">
          <AlertDescription>
            {(summaryError as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs — wrap horizontally on narrow viewports so labels stay
          readable. Each tab carries its current count as a pill. */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Nhóm việc cần làm"
      >
        {TODO_CATEGORIES.map((cat) => {
          const count = countByCategory.get(cat) ?? 0;
          const active = cat === category;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
              className={`inline-flex items-center gap-2 px-3 h-9 text-sm rounded-md border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-muted/50"
              }`}
            >
              <span>{CATEGORY_META[cat].label}</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {summaryLoading ? "…" : count.toLocaleString("vi-VN")}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {CATEGORY_META[category].description}
      </p>

      {itemsError && (
        <Alert variant="destructive">
          <AlertDescription>{(itemsError as Error).message}</AlertDescription>
        </Alert>
      )}

      {itemsLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {rows && rows.length === 0 && !itemsLoading && (
        <EmptyState
          icon={<IconCheck className="h-10 w-10" />}
          title="Sạch sẽ ở nhóm này"
          description="Không còn mục nào thiếu thuộc nhóm đã chọn."
        />
      )}

      {canEdit && selected.size > 0 && (
        <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-3 py-2 bg-card border-y sm:border sm:rounded-md flex items-center gap-3 shadow-sm">
          <span className="text-sm">
            Đã chọn <strong className="tabular-nums">{selected.size}</strong>{" "}
            người
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set())}
            className="h-9"
          >
            Bỏ chọn
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onBulkExclude}
            disabled={bulkExcludeMutation.isPending}
            className="h-9"
          >
            <IconX className="h-4 w-4 mr-1.5" />
            {bulkExcludeMutation.isPending
              ? "Đang loại…"
              : `Loại khỏi DS`}
          </Button>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="divide-y rounded-md border bg-card">
          {rows.map((row) => (
            <li
              key={row.person_id}
              className="flex items-center gap-1 hover:bg-muted/50"
            >
              {canEdit && (
                <label
                  className="shrink-0 pl-3 py-2.5 cursor-pointer inline-flex items-center"
                  title={
                    selected.has(row.person_id)
                      ? "Bỏ chọn"
                      : "Chọn để xử lý hàng loạt"
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.person_id)}
                    onChange={() => toggleSelected(row.person_id)}
                    className="h-5 w-5 accent-primary"
                    aria-label={`Chọn ${row.full_name}`}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => openItem(row)}
                className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left min-w-0"
              >
                <PersonAvatar gender={row.gender} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium truncate">
                      {row.full_name}
                    </span>
                    {row.generation !== null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Đời {row.generation}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {row.birth_year && (
                      <span>Sinh {row.birth_year}</span>
                    )}
                    {row.death_year && (
                      <span>Mất {row.death_year}</span>
                    )}
                    {!row.is_living &&
                      !row.death_year &&
                      !row.birth_year && (
                        <span>Đã mất, chưa rõ năm</span>
                      )}
                    {row.missing.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center text-amber-700 dark:text-amber-400"
                      >
                        • {MISSING_LABEL[m] ?? m}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground text-sm shrink-0">
                  →
                </span>
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => excludeMutation.mutate(row.person_id)}
                  disabled={excludeMutation.isPending}
                  className="shrink-0 mr-2 inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-background hover:text-foreground"
                  title="Loại khỏi danh sách (không hiện ở đây nữa)"
                >
                  <IconX className="h-3.5 w-3.5" />
                  Bỏ qua
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalForCategory > 0 && (
        <div className="flex items-center justify-between text-sm pt-2">
          <div className="text-muted-foreground">
            {totalForCategory.toLocaleString("vi-VN")} mục
            {totalForCategory > 0 && (
              <span className="hidden sm:inline">
                {" "}
                — đang xem {startIdx.toLocaleString("vi-VN")}–
                {endIdx.toLocaleString("vi-VN")}
              </span>
            )}
            {itemsFetching && !itemsLoading && (
              <span className="ml-2 italic">đang tải…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Trang trước"
            >
              <IconArrowLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Trước</span>
            </Button>
            <span className="px-2 tabular-nums">
              {safePage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Trang sau"
            >
              <span className="hidden sm:inline">Sau</span>
              <IconArrowRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </div>
      )}

      <QuickDateFixSheet
        open={quickDateFix !== null}
        onClose={() => setQuickDateFix(null)}
        clanId={clan.id}
        personId={quickDateFix?.person_id ?? ""}
        missing={quickDateFix?.missing ?? []}
      />

      <QuickAddSheet
        open={quickParentFix !== null}
        onClose={() => setQuickParentFix(null)}
        clanId={clan.id}
        personId={quickParentFix?.person_id ?? ""}
        defaultRelation="parent"
      />
    </div>
  );
}

function CompletionProgress({
  completion,
}: {
  completion: import("@/lib/queries/todo").ClanCompletion;
}) {
  const { total, complete, percent } = completion;
  // Bias the bar color so the empty middle range doesn't read like
  // a failure — gia phả completion is a long-tail effort and the
  // tone here should be encouraging.
  const tone =
    (percent ?? 0) >= 90
      ? "bg-emerald-500"
      : (percent ?? 0) >= 50
        ? "bg-primary"
        : "bg-amber-500";
  return (
    <section
      aria-label="Tiến độ hoàn thiện gia phả"
      className="rounded-lg border bg-card p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-medium">Họ ta đã hoàn thành</h2>
        <span className="text-2xl sm:text-3xl font-semibold tabular-nums">
          {percent}%
        </span>
      </div>
      <div
        className="h-2.5 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={percent ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full ${tone} transition-[width] duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="tabular-nums">
          {complete.toLocaleString("vi-VN")}
        </span>{" "}
        / {total.toLocaleString("vi-VN")} người có đủ năm sinh và quan
        hệ cha/mẹ. Cùng nhau bổ sung để kéo lên 100%.
      </p>
    </section>
  );
}
