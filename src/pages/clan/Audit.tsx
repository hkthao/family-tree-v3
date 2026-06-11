import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronUp,
  IconRefresh,
  IconUndo,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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

  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<AuditEntity | "">("");
  const [action, setAction] = useState<AuditAction | "">("");

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
    <div className="space-y-4">
      <nav>
        <BackLink fallback={`/clans/${clan.id}`} />
      </nav>
      <h2 className="text-2xl font-semibold">Nhật ký chỉnh sửa</h2>
      <p className="text-sm text-muted-foreground">
        Lịch sử mọi thay đổi với người, gia đình và chi. Editor/admin có thể
        khôi phục bằng một nút bấm — soft-delete giữ dữ liệu nguyên vẹn.
      </p>

      {/* Filters in a single row at every viewport (2-col grid).
          Labels are dropped; the first option of each select serves
          as a prompt ("Mọi đối tượng" / "Mọi hành động") so the
          filter purpose is still clear without eating a label row. */}
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Lọc theo đối tượng"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as AuditEntity | "");
            setPage(1);
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
          onChange={(e) => {
            setAction(e.target.value as AuditAction | "");
            setPage(1);
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Mọi hành động</option>
          <option value="insert">Thêm mới</option>
          <option value="update">Sửa</option>
          <option value="delete">Xoá</option>
        </select>
      </div>

      {!data ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon={<IconRefresh className="h-10 w-10" />}
          title="Chưa có thay đổi nào"
          description="Mỗi lần thêm / sửa / xoá người, gia đình hay chi sẽ xuất hiện ở đây. Editor có thể khôi phục bằng một nút bấm."
        />
      ) : (
        <ul className="space-y-3">
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

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {data?.total ? `${data.total} thay đổi` : ""}
          {isFetching && <span className="ml-2 italic">đang tải…</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Trang trước"
            title="Trang trước"
            className="h-9 w-9 p-0"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm tabular-nums">
            {page}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Trang sau"
            title="Trang sau"
            className="h-9 w-9 p-0"
          >
            <IconArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
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

  const date = new Date(row.changed_at).toLocaleString("vi-VN");

  return (
    <li className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span
            className={`font-medium ${
              row.action === "delete"
                ? "text-destructive"
                : row.action === "insert"
                  ? "text-accent"
                  : ""
            }`}
          >
            {ACTION_LABEL[row.action]} {ENTITY_LABEL[row.entity_type]}
          </span>
          {name !== null && (
            <span className="ml-2 text-muted-foreground">— {String(name)}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((x) => !x)}
          aria-label={expanded ? "Thu gọn" : "Xem chi tiết"}
          title={expanded ? "Thu gọn" : "Xem chi tiết"}
          aria-expanded={expanded}
          className="h-8 w-8 p-0"
        >
          <IconChevronUp
            className={`h-4 w-4 transition-transform ${
              expanded ? "" : "rotate-180"
            }`}
          />
        </Button>
        {canRestore && isRestorableEntity(row.entity_type) && (
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
              restoreM.isPending ? "Đang khôi phục…" : "Khôi phục bản ghi"
            }
            className="h-8 w-8 p-0 text-primary disabled:opacity-50"
          >
            <IconUndo className="h-4 w-4" />
          </Button>
        )}
        {restoreM.isSuccess && (
          <span className="text-xs text-accent ml-1">✓ đã khôi phục</span>
        )}
      </div>

      {restoreM.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(restoreM.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {row.before && (
            <div>
              <p className="font-medium mb-1">Trước</p>
              <pre className="bg-muted/40 rounded p-2 overflow-x-auto max-h-64">
                {JSON.stringify(row.before, null, 2)}
              </pre>
            </div>
          )}
          {row.after && (
            <div>
              <p className="font-medium mb-1">Sau</p>
              <pre className="bg-muted/40 rounded p-2 overflow-x-auto max-h-64">
                {JSON.stringify(row.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <Link
          to={`/clans/${row.clan_id}/people/${row.entity_id}`}
          className="hover:underline"
          hidden={row.entity_type !== "person"}
        >
          Xem trang chi tiết →
        </Link>
      </div>
    </li>
  );
}
