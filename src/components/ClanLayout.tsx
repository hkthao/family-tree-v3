import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";

import { AppDrawer } from "@/components/AppDrawer";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Button } from "@/components/ui/button";
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // refetchOnMount: "always" — the clan-detail row is small and always
  // re-checking it on entry prevents stale persisted-IndexedDB data from
  // silently bouncing the user back to /clans when the cached value is
  // out of date or from a previous schema. staleTime: 0 because the
  // global default (4 hours) would otherwise short-circuit the refetch.
  const { data: clan, isLoading, isFetching, isError, error } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId ?? ""),
    queryFn: () => getClanDetail(clanId!, userId!),
    enabled: !!clanId && !!userId,
    refetchOnMount: "always",
    staleTime: 0,
  });

  if (!clanId) return <Navigate to="/clans" replace />;

  if (isLoading || (isFetching && !clan)) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải…</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">Lỗi: {(error as Error).message}</p>
        <Button asChild variant="outline">
          <Link to="/clans">← Quay lại danh sách dòng họ</Link>
        </Button>
      </main>
    );
  }

  if (!clan) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">
          Không tìm thấy dòng họ này hoặc bạn không có quyền xem.
        </p>
        <Button asChild variant="outline">
          <Link to="/clans">← Danh sách dòng họ</Link>
        </Button>
      </main>
    );
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
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
            className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0"
          >
            <span className="text-2xl leading-none" aria-hidden="true">☰</span>
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="clan-name text-lg sm:text-xl font-semibold truncate">
              {clan.name}
            </h1>
          </div>
          {(clan.myRole === "admin" || clan.isPlatformAdmin) ? (
            <Link
              to={`/clans/${clanId}/settings`}
              className="text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              Cài đặt
            </Link>
          ) : (
            <span className="w-10 shrink-0" aria-hidden="true" />
          )}
        </div>
      </header>

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="container max-w-4xl py-6 px-4">
        <Outlet context={{ clan } satisfies OutletContext} />
      </main>

      <BottomTabBar tabs={tabs} />
    </div>
  );
}
