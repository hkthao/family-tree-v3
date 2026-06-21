import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import {
  IconArrowRight,
  IconChevronUp,
  IconRefresh,
  IconUndo,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUrlPatch } from "@/hooks/useUrlState";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  isRestorableEntity,
  listAudit,
  restoreAuditEntry,
  type AuditAction,
  type AuditEntity,
  type AuditRow,
} from "@/lib/queries/audit";
import { queryKeys } from "@/lib/queries/keys";

const PAGE_SIZE = 50;

const ENTITY_LABEL: Record<AuditEntity, string> = {
  person: "Người",
  family: "Gia đình",
  branch: "Chi",
  person_link: "Liên kết thông gia",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  insert: "Thêm mới",
  update: "Sửa",
  delete: "Xoá",
};

export default function Audit() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const canEdit = canEditClan(clan);
  if (effectiveRole(clan) === null)
    return <Navigate to={`/clans/${clan.id}`} replace />;

  // Filters live in the URL so Back from a restore / detail keeps the
  // page + filters. See useUrlState.ts. Each select also resets the
  // page, written in one patch() to avoid clobbering.
  const [sp] = useSearchParams();
  const patch = useUrlPatch();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const entityType = (sp.get("type") ?? "") as AuditEntity | "";
  const action = (sp.get("act") ?? "") as AuditAction | "";
  const setPage = (n: number) => patch({ page: n <= 1 ? null : String(n) });

  const params = {
    page,
    pageSize: PAGE_SIZE,
    entityType: entityType || null,
    action: action || null,
  };

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.audit(clan.id, userId, params),
    queryFn: () => listAudit(clan.id, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Nhật ký" },
        ]}
      />

      <PageHeader
        icon={<IconRefresh className="h-7 w-7" />}
        title="Nhật ký"
        description="Lịch sử mọi thay đổi với người, gia đình và chi. Editor/admin có thể khôi phục."
        actionsBelow
        actions={
          <>
            <select
              aria-label="Lọc theo đối tượng"
              value={entityType}
              onChange={(e) =>
                patch({ type: e.target.value || null, page: null })
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0"
            >
              <option value="">Mọi đối tượng</option>
              <option value="person">Người</option>
              <option value="family">Gia đình</option>
              <option value="branch">Chi</option>
              <option value="person_link">Liên kết thông gia</option>
            </select>
            <select
              aria-label="Lọc theo hành động"
              value={action}
              onChange={(e) =>
                patch({ act: e.target.value || null, page: null })
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0"
            >
              <option value="">Mọi hành động</option>
              <option value="insert">Thêm mới</option>
              <option value="update">Sửa</option>
              <option value="delete">Xoá</option>
            </select>
          </>
        }
      />

      {!data ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon={<IconRefresh className="h-10 w-10" />}
          title="Chưa có thay đổi nào"
          description="Mỗi lần thêm / sửa / xoá người, gia đình hay chi sẽ xuất hiện ở đây. Editor có thể khôi phục bằng một nút bấm."
        />
      ) : (
        <ul className="rounded-lg border bg-card divide-y overflow-hidden">
          {data.rows.map((r) => (
            <AuditItem
              key={r.id}
              row={r}
              canRestore={canEdit}
              onRestored={async () => {
                await qc.invalidateQueries({
                  queryKey: queryKeys.audit(clan.id, userId, params),
                });
                await invalidateClanData(qc, clan.id);
              }}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={data?.total ?? 0}
        pageSize={PAGE_SIZE}
        unit="thay đổi"
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}

function AuditItem({
  row,
  canRestore,
  onRestored,
}: {
  row: AuditRow;
  canRestore: boolean;
  onRestored: () => Promise<void> | void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);

  const restoreM = useMutation({
    mutationFn: () => restoreAuditEntry(row.id),
    onSuccess: () => {
      onRestored();
      toast.success("Đã khôi phục");
    },
    onError: (e) =>
      toast.error("Không khôi phục được", {
        description: (e as Error).message,
      }),
  });

  const name =
    (row.before as Record<string, unknown> | null)?.full_name ??
    (row.after as Record<string, unknown> | null)?.full_name ??
    (row.before as Record<string, unknown> | null)?.name ??
    (row.after as Record<string, unknown> | null)?.name ??
    null;

  const dateFull = new Date(row.changed_at).toLocaleString("vi-VN");
  const dateShort = formatAuditRelative(row.changed_at);
  const canRestoreEntry =
    canRestore && isRestorableEntity(row.entity_type);
  const canViewDetail = row.entity_type === "person";

  return (
    <li className="hover:bg-muted/20 transition-colors">
      {/* Compact row — 1 dòng cho mọi info chính */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
        {/* Action badge */}
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${ACTION_BADGE[row.action]}`}
          title={`Hành động: ${ACTION_LABEL[row.action]}`}
        >
          {ACTION_LABEL[row.action]}
        </span>

        {/* Entity + name */}
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5 truncate">
          <span className="text-xs text-muted-foreground shrink-0">
            {ENTITY_LABEL[row.entity_type]}
          </span>
          {name !== null && (
            <span className="text-sm font-medium truncate">
              {String(name)}
            </span>
          )}
        </div>

        {/* Date */}
        <time
          className="hidden sm:block text-xs text-muted-foreground tabular-nums shrink-0"
          dateTime={row.changed_at}
          title={dateFull}
        >
          {dateShort}
        </time>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {canViewDetail && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <Link
                to={`/clans/${row.clan_id}/people/${row.entity_id}`}
                aria-label="Xem trang chi tiết"
                title="Xem trang chi tiết"
              >
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {canRestoreEntry && (
            <Button
              size="sm"
              variant="ghost"
              data-testid="audit-restore-button"
              disabled={restoreM.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Khôi phục về trạng thái ${
                    row.action === "delete" ? "trước khi xoá" : "trước khi sửa"
                  }?`,
                  confirmLabel: "Khôi phục",
                });
                if (ok) restoreM.mutate();
              }}
              aria-label="Khôi phục"
              title={
                restoreM.isPending
                  ? "Đang khôi phục…"
                  : "Khôi phục về trạng thái trước"
              }
              className="h-8 w-8 p-0 text-primary disabled:opacity-50"
            >
              <IconUndo className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((x) => !x)}
            aria-label={expanded ? "Thu gọn" : "Xem JSON diff"}
            title={expanded ? "Thu gọn" : "Xem JSON diff trước/sau"}
            aria-expanded={expanded}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <IconChevronUp
              className={`h-4 w-4 transition-transform ${
                expanded ? "" : "rotate-180"
              }`}
            />
          </Button>
        </div>
      </div>

      {restoreM.isSuccess && (
        <p className="px-4 pb-2 text-xs text-accent">
          ✓ Đã khôi phục
        </p>
      )}
      {restoreM.error && (
        <Alert variant="destructive" className="mx-3 mb-2">
          <AlertDescription>
            {(restoreM.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {expanded && (
        <div className="border-t bg-muted/10 px-3 sm:px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {row.before && (
              <div>
                <p className="font-medium mb-1 text-muted-foreground">
                  Trước
                </p>
                <pre className="bg-card rounded p-2 overflow-x-auto max-h-64 border">
                  {JSON.stringify(row.before, null, 2)}
                </pre>
              </div>
            )}
            {row.after && (
              <div>
                <p className="font-medium mb-1 text-muted-foreground">
                  Sau
                </p>
                <pre className="bg-card rounded p-2 overflow-x-auto max-h-64 border">
                  {JSON.stringify(row.after, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

const ACTION_BADGE: Record<AuditAction, string> = {
  insert:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  update: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  delete:
    "bg-destructive/10 text-destructive border border-destructive/30",
};

/**
 * "vừa xong" / "10 phút" / "Hôm qua" / "5 ngày" / dd/MM/yyyy — khớp
 * format relative dùng ở Board + Announcements.
 */
function formatAuditRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút`;
  if (diffHr < 24) return `${diffHr} giờ`;
  if (diffDay === 1) return "Hôm qua";
  if (diffDay < 7) return `${diffDay} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
