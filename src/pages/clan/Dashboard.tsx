import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { RefreshButton } from "@/components/RefreshButton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { getClanStats } from "@/lib/queries/clan-stats";
import { queryKeys } from "@/lib/queries/keys";

export default function Dashboard() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = clan.myRole === "admin" || clan.myRole === "editor";

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.clanStats(clan.id, userId),
    queryFn: () => getClanStats(clan.id),
    enabled: !!userId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Tổng quan</h2>
        <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
      </div>

      {clan.description && (
        <p className="text-muted-foreground">{clan.description}</p>
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {stats && stats.total_persons === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Chưa có ai trong dòng họ</CardTitle>
            <CardDescription>
              {canEdit
                ? "Bắt đầu bằng cách thêm thuỷ tổ hoặc nhập từ Excel."
                : "Quản trị/biên tập viên sẽ thêm thành viên trước."}
            </CardDescription>
          </CardHeader>
          {canEdit && (
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/clans/${clan.id}/people/new`}>+ Thêm người</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/clans/${clan.id}/import`}>Nhập từ Excel</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : stats ? (
        <>
          <section
            aria-label="Thống kê dòng họ"
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            <StatTile label="Tổng số người" value={stats.total_persons} highlight />
            <StatTile label="Số đời" value={stats.max_generation ?? "—"} />
            <StatTile label="Số chi" value={stats.branches} />
            <StatTile label="Nam" value={stats.males} />
            <StatTile label="Nữ" value={stats.females} />
            <StatTile label="Còn sống" value={stats.living} />
            <StatTile label="Đã mất" value={stats.deceased} muted />
          </section>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/clans/${clan.id}/people`}>Xem danh bạ</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/clans/${clan.id}/tree`}>Xem cây gia phả</Link>
            </Button>
            {canEdit && (
              <>
                <Button asChild variant="outline">
                  <Link to={`/clans/${clan.id}/people/new`}>+ Thêm người</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/clans/${clan.id}/import`}>Nhập từ Excel</Link>
                </Button>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number | string;
  highlight?: boolean;
  muted?: boolean;
}

function StatTile({ label, value, highlight, muted }: StatTileProps) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${
        highlight ? "border-primary/40" : ""
      }`}
    >
      <p
        className={`text-3xl font-semibold ${
          muted ? "text-muted-foreground" : highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
