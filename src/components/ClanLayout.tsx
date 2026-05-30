import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";

import { BottomTabBar } from "@/components/BottomTabBar";
import { useAuth } from "@/hooks/useAuth";
import { getClanDetail, type ClanDetail } from "@/lib/queries/clan-detail";
import { queryKeys } from "@/lib/queries/keys";

interface OutletContext {
  clan: ClanDetail;
}

export function ClanLayout() {
  const { clanId } = useParams<{ clanId: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const { data: clan, isLoading } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId ?? ""),
    queryFn: () => getClanDetail(clanId!, userId!),
    enabled: !!clanId && !!userId,
  });

  if (!clanId) return <Navigate to="/clans" replace />;

  if (isLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải…</p>
      </main>
    );
  }

  if (!clan) {
    return <Navigate to="/clans" replace />;
  }

  const tabs = [
    { to: `/clans/${clanId}`, label: "Tổng quan", icon: "🏠", end: true },
    { to: `/clans/${clanId}/people`, label: "Danh bạ", icon: "📋" },
    { to: `/clans/${clanId}/tree`, label: "Cây", icon: "🌳" },
    { to: `/clans/${clanId}/events`, label: "Sự kiện", icon: "🗓" },
    { to: "/account", label: "Tài khoản", icon: "👤" },
  ];

  return (
    <div className="min-h-dvh bg-background pb-20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container max-w-4xl flex items-center justify-between gap-3 py-3 px-4">
          <Link
            to="/clans"
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="Quay lại danh sách dòng họ"
          >
            ← Đổi dòng họ
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="clan-name text-lg sm:text-xl font-semibold truncate">
              {clan.name}
            </h1>
          </div>
          {clan.myRole === "admin" ? (
            <Link
              to={`/clans/${clanId}/settings`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cài đặt
            </Link>
          ) : (
            <span className="w-[88px]" aria-hidden="true" />
          )}
        </div>
      </header>

      <main className="container max-w-4xl py-6 px-4">
        <Outlet context={{ clan } satisfies OutletContext} />
      </main>

      <BottomTabBar tabs={tabs} />
    </div>
  );
}
