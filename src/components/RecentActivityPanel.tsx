import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import { listAudit, type AuditRow } from "@/lib/queries/audit";

interface Props {
  clanId: string;
  limit?: number;
}

const ENTITY_LABEL: Record<string, string> = {
  person: "người",
  family: "gia đình",
  branch: "chi",
};
const ACTION_LABEL: Record<string, string> = {
  insert: "Thêm",
  update: "Cập nhật",
  delete: "Xoá",
};

/**
 * Per-action visual treatment for the circle that leads each row.
 * Using a small coloured icon avatar instead of a full-row pill keeps
 * the feed scannable — the eye can pick out a delete (red) or an
 * insert (green) without the row screaming for attention.
 */
const ACTION_VISUAL: Record<
  string,
  { icon: React.ReactNode; classes: string }
> = {
  insert: {
    icon: <IconPlus className="h-4 w-4" />,
    classes: "bg-accent/20 text-accent",
  },
  update: {
    icon: <IconPencil className="h-4 w-4" />,
    classes: "bg-primary/15 text-primary",
  },
  delete: {
    icon: <IconTrash className="h-4 w-4" />,
    classes: "bg-destructive/15 text-destructive",
  },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} ngày trước`;
  // Fall back to absolute date past a week.
  return new Date(iso).toLocaleDateString("vi-VN");
}

function entityName(r: AuditRow): string {
  const src = r.after ?? r.before ?? {};
  if (typeof src["full_name"] === "string") return src["full_name"] as string;
  if (typeof src["name"] === "string") return src["name"] as string;
  return "(không tên)";
}

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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hoạt động gần đây</h3>
        <Link
          to={`/clans/${clanId}/audit`}
          className="text-sm text-primary hover:underline"
        >
          Xem nhật ký →
        </Link>
      </div>
      <ul className="space-y-1">
        {data.rows.map((r) => {
          const action = ACTION_LABEL[r.action] ?? r.action;
          const entity = ENTITY_LABEL[r.entity_type] ?? r.entity_type;
          const visual = ACTION_VISUAL[r.action] ?? {
            icon: null,
            classes: "bg-muted text-muted-foreground",
          };
          const linkTarget =
            r.entity_type === "person"
              ? `/clans/${clanId}/people/${r.entity_id}`
              : `/clans/${clanId}/audit`;
          return (
            <li key={r.id}>
              <Link
                to={linkTarget}
                className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-muted/40"
              >
                <span
                  className={`h-8 w-8 rounded-full inline-flex items-center justify-center shrink-0 ${visual.classes}`}
                  aria-hidden="true"
                >
                  {visual.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {entityName(r)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {action} {entity}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {timeAgo(r.changed_at)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
