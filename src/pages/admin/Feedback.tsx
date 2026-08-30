import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  IconCheck,
  IconRefresh,
  IconScroll,
} from "@/components/icons";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUrlState } from "@/hooks/useUrlState";
import {
} from "@/lib/queries/announcements";
import {
  getFeedbackSenders,
  listFeedback,
  updateFeedback,
  type FeedbackRow,
  type FeedbackSender,
  type FeedbackStatus,
} from "@/lib/queries/feedback";
import { queryKeys } from "@/lib/queries/keys";
import type { FeedbackCategory } from "@/lib/queries/feedback";
import { unaccent } from "@/lib/unaccent";

const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Mới",
  seen: "Đã xem",
  resolved: "Đã xử lý",
  spam: "Spam",
};

const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Lỗi",
  idea: "Ý kiến",
  question: "Câu hỏi",
  other: "Khác",
};

const FEEDBACK_STATUS_BADGE: Record<FeedbackStatus, string> = {
  new: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  seen: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  spam: "bg-muted text-muted-foreground border-border",
};

export function FeedbackTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminFeedback(),
    queryFn: () => listFeedback(),
    staleTime: 30_000,
  });
  // Phân giải người gửi (tên + email) cho mọi feedback có user_id để admin
  // biết là ai mà hỗ trợ (vd mở khoá giới hạn dòng họ).
  const senderIds = (data ?? []).map((r) => r.user_id);
  const { data: senders } = useQuery({
    queryKey: ["feedback-senders", senderIds],
    queryFn: () => getFeedbackSenders(senderIds),
    enabled: senderIds.some(Boolean),
  });
  const [search, setSearch] = useUrlState("q", "");
  const [statusRaw, setStatusFilter] = useUrlState("status", "new");
  const statusFilter = (
    ["all", "new", "seen", "resolved", "spam"].includes(statusRaw)
      ? statusRaw
      : "new"
  ) as FeedbackStatus | "all";

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const needle = unaccent(search);
      rows = rows.filter((r) => {
        const hay = unaccent(
          `${r.message} ${r.contact ?? ""} ${r.page_path ?? ""} ${r.admin_note ?? ""}`,
        );
        return hay.includes(needle);
      });
    }
    return rows;
  }, [data, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<FeedbackStatus, number> = {
      new: 0,
      seen: 0,
      resolved: 0,
      spam: 0,
    };
    for (const r of data ?? []) c[r.status]++;
    return c;
  }, [data]);

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải…</p>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Tổng <strong>{data?.length ?? 0}</strong> phản hồi
          {(data?.length ?? 0) >= 500 && " (đang giới hạn 500 mới nhất)"}
          .
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Tải lại"
          title={isFetching ? "Đang tải…" : "Tải lại"}
          className="h-9 w-9 p-0"
        >
          <IconRefresh
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["all", "new", "seen", "resolved", "spam"] as const).map((s) => {
          const active = statusFilter === s;
          const label = s === "all" ? "Tất cả" : FEEDBACK_STATUS_LABEL[s];
          const count = s === "all" ? data?.length ?? 0 : counts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 h-9 rounded-md border text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted/40"
              }`}
            >
              {label}{" "}
              <span className={active ? "opacity-80" : "text-muted-foreground"}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>
      <SearchInput
        label="Tìm trong nội dung / liên hệ / ghi chú"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo nội dung, email/SĐT, hoặc ghi chú admin…"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {data?.length === 0
            ? "Chưa có phản hồi nào — chờ early users gửi."
            : "Không khớp bộ lọc hiện tại."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <FeedbackRowCard
              key={row.id}
              row={row}
              sender={row.user_id ? senders?.get(row.user_id) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackRowCard({
  row,
  sender,
}: {
  row: FeedbackRow;
  sender?: FeedbackSender;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(row.admin_note ?? "");
  const [showNote, setShowNote] = useState(!!row.admin_note);

  const mutation = useMutation({
    mutationFn: (patch: { status?: FeedbackStatus; admin_note?: string | null }) =>
      updateFeedback(row.id, patch),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.adminFeedback() }),
  });

  return (
    <li className="rounded-lg border bg-card p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${FEEDBACK_STATUS_BADGE[row.status]}`}
          >
            {FEEDBACK_STATUS_LABEL[row.status]}
          </span>
          <span className="text-xs text-muted-foreground">
            {FEEDBACK_CATEGORY_LABEL[row.category]}
          </span>
        </div>
        <time
          className="text-xs text-muted-foreground shrink-0 tabular-nums"
          dateTime={row.created_at}
          title={row.created_at}
        >
          {new Date(row.created_at).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {row.message}
      </p>

      <dl className="text-xs text-muted-foreground grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
        {row.contact && (
          <>
            <dt>Liên lạc:</dt>
            <dd className="break-all">{row.contact}</dd>
          </>
        )}
        {row.user_id ? (
          <>
            <dt>Người gửi:</dt>
            <dd className="break-all">
              <span className="text-foreground font-medium">
                {sender?.display_name || sender?.email || "(đang tải…)"}
              </span>
              {sender?.email && sender?.display_name && (
                <span className="text-muted-foreground"> · {sender.email}</span>
              )}
              {/* Mở thẳng tab Quản trị → Người dùng, lọc sẵn theo email để
                  xem dòng họ của họ + chỉnh giới hạn (vd mở khoá max_clans). */}
              {sender?.email && (
                <Link
                  to={`/admin?tab=users&q=${encodeURIComponent(sender.email)}`}
                  className="ml-2 text-primary hover:underline"
                >
                  Quản lý ↗
                </Link>
              )}
              <span className="block font-mono opacity-50">{row.user_id}</span>
            </dd>
          </>
        ) : (
          <>
            <dt>Người gửi:</dt>
            <dd className="italic">khách (chưa đăng nhập)</dd>
          </>
        )}
        {row.clan_id && (
          <>
            <dt>Clan:</dt>
            <dd>
              <Link
                to={`/clans/${row.clan_id}`}
                className="text-primary hover:underline font-mono break-all"
              >
                {row.clan_id} ↗
              </Link>
            </dd>
          </>
        )}
        {row.page_path && (
          <>
            <dt>Trang:</dt>
            <dd className="font-mono break-all">{row.page_path}</dd>
          </>
        )}
        {row.app_version && (
          <>
            <dt>Phiên bản:</dt>
            <dd className="font-mono">{row.app_version}</dd>
          </>
        )}
        {row.user_agent && (
          <>
            <dt>UA:</dt>
            <dd className="break-all opacity-70">{row.user_agent}</dd>
          </>
        )}
      </dl>

      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t">
        {(["seen", "resolved", "spam"] as FeedbackStatus[]).map((s) => {
          const active = row.status === s;
          return (
            <Button
              key={s}
              size="sm"
              variant={active ? "default" : "outline"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status: s })}
            >
              {active && <IconCheck className="h-4 w-4 mr-1.5" />}
              {FEEDBACK_STATUS_LABEL[s]}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNote((v) => !v)}
        >
          <IconScroll className="h-4 w-4 mr-1.5" />
          {showNote ? "Ẩn ghi chú" : "Ghi chú"}
        </Button>
      </div>

      {showNote && (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú nội bộ (chỉ admin xem)…"
            rows={2}
            maxLength={4000}
            className="text-sm resize-y"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={mutation.isPending || note === (row.admin_note ?? "")}
            onClick={() =>
              mutation.mutate({ admin_note: note.trim() || null })
            }
          >
            <IconCheck className="h-4 w-4 mr-1.5" />
            Lưu ghi chú
          </Button>
        </div>
      )}
    </li>
  );
}

// ───────────── Announcements admin tab (§32.2) ──────────────────────

