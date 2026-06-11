import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { IconScroll } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  listContributions,
  type ContributionRow,
  type ContributionStatus,
} from "@/lib/queries/contributions";
import { queryKeys } from "@/lib/queries/keys";

const STATUS_FILTERS: Array<{
  value: ContributionStatus | "all";
  label: string;
}> = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
  { value: "needs_info", label: "Cần thêm" },
  { value: "all", label: "Tất cả" },
];

const TYPE_LABEL: Record<ContributionRow["contribution_type"], string> = {
  edit_person: "Sửa",
  add_note: "Bổ sung tiểu sử",
  add_person: "Thêm người",
};

const STATUS_TONE: Record<ContributionStatus, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  approved: "text-accent",
  rejected: "text-destructive",
  needs_info: "text-muted-foreground",
};

/**
 * /clans/:id/contributions — admin/editor review queue.
 *
 * RLS already filters out viewers from this list (they only see their
 * own submissions, never anyone else's), and the apply/reject RPCs
 * enforce admin-only at the SQL layer. We still gate the navigation
 * client-side so viewers don't accidentally land here.
 */
export default function Contributions() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);

  if (!canEdit) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  const [status, setStatus] = useState<ContributionStatus | "all">("pending");
  const { data: rows, isLoading, error } = useQuery({
    queryKey: queryKeys.contributions(clan.id, userId, { status }),
    queryFn: () => listContributions(clan.id, { status }),
    enabled: !!userId,
  });

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Đóng góp" },
        ]}
      />

      <header className="flex items-start gap-3">
        <IconScroll className="h-7 w-7 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="clan-name text-xl sm:text-2xl font-semibold leading-tight">
            Đóng góp từ cộng đồng
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Người xem đề xuất sửa hoặc thêm thông tin — admin duyệt
            trước khi áp dụng vào gia phả.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            aria-pressed={status === f.value}
            className={`px-3 h-9 text-sm rounded-md border ${
              status === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input bg-background hover:bg-muted/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {rows && rows.length === 0 && !isLoading && (
        <EmptyState
          icon={<IconScroll className="h-10 w-10" />}
          title="Chưa có đóng góp nào"
          description="Khi có người gửi đề xuất, danh sách sẽ xuất hiện ở đây."
        />
      )}

      {rows && rows.length > 0 && (
        <ul className="rounded-md border divide-y bg-card overflow-hidden">
          {rows.map((c) => (
            <ContributionRowItem key={c.id} c={c} clanId={clan.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ContributionRowItem({
  c,
  clanId,
}: {
  c: ContributionRow;
  clanId: string;
}) {
  const submitterDisplay =
    c.submitter_name ??
    (c.submitter_user_id ? "Thành viên" : "Khách");
  return (
    <li>
      <Link
        to={`/clans/${clanId}/contributions/${c.id}`}
        className="flex items-start gap-3 px-3 py-3 hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className={`font-medium ${STATUS_TONE[c.status]}`}>
              {c.status === "pending"
                ? "Chờ duyệt"
                : c.status === "approved"
                  ? "Đã duyệt"
                  : c.status === "rejected"
                    ? "Đã từ chối"
                    : "Cần thêm"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {TYPE_LABEL[c.contribution_type]}
            </span>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Người gửi:</span>{" "}
            <span className="font-medium">{submitterDisplay}</span>
            {c.submitter_relation && (
              <span className="text-muted-foreground"> · {c.submitter_relation}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(c.created_at).toLocaleString("vi-VN")}
            {c.submitter_user_id === null && " · qua link chia sẻ"}
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 self-center">›</span>
      </Link>
    </li>
  );
}
