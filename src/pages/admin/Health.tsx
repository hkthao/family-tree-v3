import { useMutation, useQuery } from "@tanstack/react-query";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  IconRefresh,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  clearFailedNotification,
  getPlatformDbStats,
  type FailedNotification,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";

export function HealthTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.platformDbStats(),
    queryFn: () => getPlatformDbStats(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Đang tải…</p>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Cập nhật lúc {new Date(data.generated_at).toLocaleString("vi-VN")}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Làm mới"
          title={isFetching ? "Đang tải…" : "Làm mới"}
          className="h-9 w-9 p-0"
        >
          <IconRefresh
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cần chú ý</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <StateTile
            label="Đóng góp chờ duyệt"
            value={data.states.contributions_pending}
            highlight={data.states.contributions_pending > 0}
          />
          <StateTile
            label="Liên kết thông gia chờ"
            value={data.states.person_links_pending}
            highlight={data.states.person_links_pending > 0}
          />
          <StateTile
            label="Share-link đang hoạt động"
            value={data.states.share_links_active}
          />
          <StateTile
            label="Notify thất bại (tổng)"
            value={data.states.notifications_failed_total}
            highlight={data.states.notifications_failed_total > 0}
          />
          <StateTile
            label="Tài khoản tổng"
            value={data.states.users_total}
          />
          <StateTile
            label="Bị khoá"
            value={data.states.users_suspended}
            highlight={data.states.users_suspended > 0}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Hoạt động gần đây</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RateTile label="Người mới (24h)" value={data.rates.persons_24h ?? 0} />
          <RateTile label="Người mới (7 ngày)" value={data.rates.persons_7d ?? 0} />
          <RateTile label="Người mới (30 ngày)" value={data.rates.persons_30d ?? 0} />
          <RateTile label="Dòng họ mới (7d)" value={data.rates.clans_7d ?? 0} />
          <RateTile label="Dòng họ mới (30d)" value={data.rates.clans_30d ?? 0} />
          <RateTile label="Tài khoản mới (7d)" value={data.rates.users_7d ?? 0} />
          <RateTile label="Tài khoản mới (30d)" value={data.rates.users_30d ?? 0} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Số dòng + dung lượng</h2>
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Bảng</th>
                <th className="text-right px-3 py-2 font-medium">Số dòng</th>
                <th className="text-right px-3 py-2 font-medium">Dung lượng</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.rows)
                .sort(([, a], [, b]) => b - a)
                .map(([table, count]) => (
                  <tr key={table} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{table}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatNumber(count)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {table === "auth_users"
                        ? "—"
                        : formatBytes(data.sizes_bytes[table] ?? 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Lịch chạy nền (cron)</h2>
        {data.cron.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            pg_cron chưa cài hoặc chưa có job nào — local dev là bình thường.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.cron.map((job) => (
              <CronRow key={job.jobname} job={job} />
            ))}
          </ul>
        )}
      </section>

      <FailedNotificationsSection
        rows={data.recent_failed_notifications}
        total={data.states.notifications_failed_total}
        onChanged={() => refetch()}
      />
    </div>
  );
}

function FailedNotificationsSection({
  rows,
  total,
  onChanged,
}: {
  rows: FailedNotification[];
  total: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const clearM = useMutation({
    mutationFn: (id: string) => clearFailedNotification(id),
    onSuccess: () => {
      toast.success("Đã xoá — lần cron tới sẽ thử lại");
      onChanged();
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  if (total === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Email/SMS thất bại</h2>
        <p className="text-sm text-muted-foreground">
          Không có lượt gửi nào thất bại. 👌
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Email/SMS thất bại</h2>
        <p className="text-xs text-muted-foreground">
          10 lần gần nhất trong tổng {formatNumber(total)} lượt
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Đếm tổng có {formatNumber(total)} nhưng không lấy được context —
          có thể row đã bị cascade xoá.
        </p>
      ) : (
        <ul className="rounded-md border bg-background divide-y">
          {rows.map((n) => (
            <li key={n.id} className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {n.user_email ?? "(người dùng đã xoá)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-foreground">
                      {n.clan_name ?? "(clan đã xoá)"}
                    </span>{" "}
                    · {n.channel} ·{" "}
                    <span className="font-mono">{n.event_key}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.sent_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={clearM.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Xoá log thất bại?",
                      description:
                        "Sau khi xoá, lần cron tới (mặc định mỗi tối) sẽ thử gửi lại sự kiện này.",
                      confirmLabel: "Xoá để thử lại",
                    });
                    if (ok) clearM.mutate(n.id);
                  }}
                >
                  <IconRefresh className="h-4 w-4 mr-1.5" />
                  Xoá để thử lại
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StateTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (highlight ? "border-primary bg-primary/5" : "bg-card")
      }
    >
      <p
        className={
          "text-2xl font-semibold tabular-nums " +
          (highlight ? "text-primary" : "")
        }
      >
        {formatNumber(value)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function RateTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xl font-semibold tabular-nums">
        {formatNumber(value)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function CronRow({ job }: { job: { jobname: string; schedule: string; active: boolean; last_run: { status: string; start_time: string; end_time: string | null; return_message: string | null } | null } }) {
  const ok = job.last_run?.status === "succeeded";
  return (
    <li className="rounded-md border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-mono text-xs">{job.jobname}</p>
        <span
          className={
            "text-xs px-2 py-0.5 rounded " +
            (ok
              ? "bg-accent/15 text-accent"
              : job.last_run
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground")
          }
        >
          {job.last_run ? (ok ? "Thành công" : job.last_run.status) : "Chưa chạy"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Schedule: <span className="font-mono">{job.schedule}</span>
        {!job.active && " · tạm tắt"}
      </p>
      {job.last_run && (
        <p className="text-xs text-muted-foreground">
          Lần cuối: {new Date(job.last_run.start_time).toLocaleString("vi-VN")}
        </p>
      )}
    </li>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ───────────── Feedback tab ─────────────────────────────────────────



