import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ClanAvatarFrameProvider } from "@/components/PersonAvatar";
import {
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
} from "react-router-dom";

import { AiChatDock } from "@/components/ai/AiChatDock";
import { HeaderActions } from "@/components/HeaderActions";
import { AppDrawer } from "@/components/AppDrawer";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PanelHost } from "@/components/panel/PanelHost";
import {
  IconArrowLeft,
  IconCalendar,
  IconHome,
  IconSun,
  IconTree,
  IconUsers,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useSidebarHidden } from "@/lib/sidebarHidden";
import { useClanRealtime } from "@/hooks/useClanRealtime";
import { useCompletionMilestone } from "@/hooks/useCompletionMilestone";
import { getClanDetail, type ClanDetail } from "@/lib/queries/clan-detail";
import { HISTORICAL_CATEGORY_LABEL } from "@/lib/queries/historical";
import { queryKeys } from "@/lib/queries/keys";
import { countClanTodo } from "@/lib/queries/todo";

import { t } from "@lingui/core/macro";
interface OutletContext {
  clan: ClanDetail;
}

export function ClanLayout() {
  const { clanId } = useParams<{ clanId: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // refetchOnMount: "always" — the clan-detail row is small and always
  // re-checking it on entry prevents stale persisted-IndexedDB data from
  // silently bouncing the user back to /clans when the cached value is
  // out of date or from a previous schema. staleTime: 0 because the
  // global default (4 hours) would otherwise short-circuit the refetch.
  const {
    data: clan,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId ?? ""),
    queryFn: () => getClanDetail(clanId!, userId!),
    enabled: !!clanId && !!userId,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Subscribe to live updates so edits from other members propagate
  // without manual refresh. Idempotent — running parallel to the
  // RefreshButton, not in place of it.
  useClanRealtime(clanId, clan?.data_version);

  if (!clanId) return <Navigate to="/clans" replace />;

  if (isLoading || (isFetching && !clan)) {
    return (
      <main>
        <LoadingState fullscreen />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4">
        <ErrorState
          error={error}
          onRetry={() => refetch()}
          className="max-w-md w-full"
        />
        <Button asChild variant="outline">
          <Link to="/clans">
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t`Quay lại danh sách dòng họ`}
          </Link>
        </Button>
      </main>
    );
  }

  if (!clan) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">
          {t`Không tìm thấy dòng họ này hoặc bạn không có quyền xem.`}
        </p>
        <Button asChild variant="outline">
          <Link to="/clans">
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t`Danh sách dòng họ`}
          </Link>
        </Button>
      </main>
    );
  }

  // CÙNG THỨ TỰ với nhóm lõi trong menu trái (xem lib/navModel.tsx).
  // Hai thanh điều hướng xếp khác nhau thì người dùng phải học hai lần,
  // và trên máy tính họ nhớ vị trí này rồi chuyển sang điện thoại lại
  // phải dò lại từ đầu.
  const tabs = [
    {
      to: `/clans/${clanId}`,
      label: t`Tổng quan`,
      icon: <IconHome className="h-5 w-5" />,
      end: true,
    },
    {
      to: `/clans/${clanId}/tree`,
      label: t`Cây`,
      icon: <IconTree className="h-5 w-5" />,
    },
    {
      to: `/clans/${clanId}/people`,
      label: t`Danh bạ`,
      icon: <IconUsers className="h-5 w-5" />,
    },
    {
      to: `/clans/${clanId}/events`,
      label: t`Sự kiện`,
      icon: <IconCalendar className="h-5 w-5" />,
    },
    {
      to: `/clans/${clanId}/today`,
      label: t`Hôm nay`,
      icon: <IconSun className="h-5 w-5" />,
    },
  ];

  return (
    <div className="min-h-dvh bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-72 lg:pr-[var(--ai-dock-w,0px)]">
      {/* Member-only signals — non-member visitors of a public clan
          shouldn't trigger the milestone toast or the drawer badge,
          and those queries 403 for them anyway. */}
      {(clan.myRole !== null || clan.isPlatformAdmin) && (
        <MilestoneWatcher clanId={clan.id} />
      )}
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="container max-w-4xl flex items-center justify-between gap-3 px-4 h-[64px]">
          <div className="flex items-center gap-1 shrink-0 xl:absolute xl:left-3 xl:top-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t`Quay lại`}
              title={t`Quay lại`}
              className="h-10 w-10 hidden lg:inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0"
            >
              <IconArrowLeft className="h-5 w-5" />
            </button>
            <DrawerToggle
              clanId={clan.id}
              userId={userId ?? ""}
              isMember={clan.myRole !== null || clan.isPlatformAdmin}
              onOpen={() => setDrawerOpen(true)}
            />
          </div>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="clan-name text-lg sm:text-xl font-semibold truncate">
              {clan.name}
            </h1>
            {clan.kind === "historical" && (
              <p className="text-xs text-muted-foreground truncate">
                Lịch sử
                {clan.historical_category
                  ? ` · ${HISTORICAL_CATEGORY_LABEL[clan.historical_category]}`
                  : ""}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <HeaderActions />
          </div>
        </div>
      </header>

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="container max-w-4xl py-6 px-4 overflow-x-clip">
        {/* Suspense riêng cho vùng nội dung → chuyển tab (trang con lazy) chỉ
            hiện spinner ở đây, GIỮ NGUYÊN thanh nav trên/dưới. */}
        <Suspense fallback={<LoadingState className="min-h-[50vh]" />}>
          <ClanAvatarFrameProvider value={clan.avatar_frame}>
            <Outlet context={{ clan } satisfies OutletContext} />
          </ClanAvatarFrameProvider>
        </Suspense>
      </main>

      <BottomTabBar tabs={tabs} />
      {/* Ngăn kéo bên phải điều khiển bằng ?panel= (thêm / sửa người…). */}
      <PanelHost clan={clan} />
      {/* Khung chat nổi — tự ẩn trên điện thoại và khi trợ lý tắt. */}
      {(clan.myRole !== null || clan.isPlatformAdmin) && (
        <AiChatDock clan={clan} />
      )}
    </div>
  );
}

// Invisible sibling that drives milestone celebration toasts via
// the shared completion query. Kept as a separate component so the
// hook can short-circuit on its own re-renders without dragging
// the whole layout along.
function MilestoneWatcher({ clanId }: { clanId: string }) {
  useCompletionMilestone(clanId);
  return null;
}

// Mobile-only drawer button with a subtle red dot when there's open
// work in /todo. Desktop (lg+) gets the full number-badge inside the
// always-pinned drawer, so we don't need a hint here. Dot only, no
// number — the precise count lives one tap away.
function DrawerToggle({
  clanId,
  userId,
  isMember,
  onOpen,
}: {
  clanId: string;
  userId: string;
  isMember: boolean;
  onOpen: () => void;
}) {
  // count_clan_todo is member-only (raises 42501 otherwise). Skip the
  // query entirely for non-member visitors so they don't see a 403 in
  // the console; the badge dot is hidden either way.
  const { data: todoCount } = useQuery({
    queryKey: queryKeys.clanTodoCount(clanId, userId),
    queryFn: () => countClanTodo(clanId),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  const hasWork = (todoCount ?? 0) > 0;
  // Điện thoại: mở ngăn kéo. Máy tính: ẩn / hiện menu trái.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [sidebarHidden, toggleSidebar] = useSidebarHidden();
  const label = isDesktop
    ? sidebarHidden
      ? t`Hiện menu`
      : t`Ẩn menu`
    : hasWork
      ? `Mở menu — có ${todoCount} việc cần làm`
      : t`Mở menu`;
  return (
    <button
      type="button"
      onClick={isDesktop ? toggleSidebar : onOpen}
      aria-label={label}
      title={isDesktop ? label : undefined}
      className="relative lg:-order-1 h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0"
    >
      <span className="text-2xl leading-none" aria-hidden="true">
        ☰
      </span>
      {hasWork && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
        />
      )}
    </button>
  );
}
