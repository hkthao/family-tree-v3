import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { IconScroll } from "@/components/icons";
import { SectionHeading } from "@/components/SectionHeading";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import { listAudit, type AuditAction, type AuditRow } from "@/lib/queries/audit";

interface Props {
  clanId: string;
  limit?: number;
}

const ENTITY_LABEL: Record<string, string> = {
  person: "Người",
  family: "Gia đình",
  branch: "Chi",
  person_link: "Thông gia",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "Thêm mới",
  update: "Sửa",
  delete: "Xoá",
};

/**
 * Badge color theo action — khớp `/audit` để 2 panel cùng visual:
 *   insert = emerald, update = blue, delete = destructive.
 */
const ACTION_BADGE: Record<string, string> = {
  insert:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  update:
    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  delete:
    "bg-destructive/10 text-destructive border border-destructive/30",
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60_000);
  const diffHr = Math.round((now - then) / 3_600_000);
  const diffDay = Math.round((now - then) / 86_400_000);
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

function entityName(r: AuditRow): string {
  const src = r.after ?? r.before ?? {};
  if (typeof src["full_name"] === "string") return src["full_name"] as string;
  if (typeof src["name"] === "string") return src["name"] as string;
  return "(không tên)";
}

/**
 * "Hoạt động gần đây" trên Dashboard — same visual contract như trang
 * `/audit`: flat list, badge action color-coded, time relative dạt
 * phải. Chỉ ngắn (limit=8) và không có nút Khôi phục / Xem JSON
 * (those live in /audit).
 */
export function RecentActivityPanel({ clanId, limit = 8 }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const params = { page: 1, pageSize: limit } as const;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.audit(clanId, userId, params),
    queryFn: () => listAudit(clanId, params),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Đang tải hoạt động…</p>
    );
  }
  if (!data || data.rows.length === 0) {
    return null;
  }

  return (
    <section aria-label="Hoạt động gần đây" className="space-y-2">
      <SectionHeading
        icon={<IconScroll />}
        title="Hoạt động gần đây"
        action={
          <Link
            to={`/clans/${clanId}/audit`}
            className="text-sm text-primary hover:underline"
          >
            Xem nhật ký →
          </Link>
        }
      />
      <ul className="rounded-lg border bg-card divide-y overflow-hidden">
        {data.rows.map((r) => {
          const action = (r.action as AuditAction) || "update";
          const linkTarget =
            r.entity_type === "person"
              ? `/clans/${clanId}/people/${r.entity_id}`
              : `/clans/${clanId}/audit`;
          return (
            <li key={r.id} className="hover:bg-muted/20 transition-colors">
              <Link
                to={linkTarget}
                className="flex items-center gap-3 px-3 sm:px-4 py-2.5"
              >
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${ACTION_BADGE[action] ?? "bg-muted"}`}
                >
                  {ACTION_LABEL[action] ?? action}
                </span>

                <div className="flex-1 min-w-0 flex items-baseline gap-1.5 truncate">
                  <span className="text-xs text-muted-foreground shrink-0">
                    {ENTITY_LABEL[r.entity_type] ?? r.entity_type}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {entityName(r)}
                  </span>
                </div>

                <time
                  className="text-xs text-muted-foreground tabular-nums shrink-0"
                  dateTime={r.changed_at}
                  title={new Date(r.changed_at).toLocaleString("vi-VN")}
                >
                  {formatRelative(r.changed_at)}
                </time>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
