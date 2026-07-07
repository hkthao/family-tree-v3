import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { signOutAndClearCache } from "@/lib/auth-actions";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

interface Props {
  children: React.ReactNode;
}

/**
 * Detect "stale session after db reset": JWT is still valid (signed) but
 * its uid no longer exists in profiles. Any insert with owner_id = uid
 * would explode with a clans_owner_id_fkey violation. Sign the user out
 * cleanly so the next attempt re-issues a fresh JWT against the new
 * auth.users row.
 */
export function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const userId = user?.id;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.myProfile(userId ?? ""),
    queryFn: () => getMyProfile(userId!),
    enabled: !!userId,
    // Probe on every mount — cheap and we need to detect drift fast.
    refetchOnMount: "always",
    staleTime: 0,
  });

  // user signed in but no profiles row → force re-login
  const orphaned = !!user && !profileLoading && profile === null;

  useEffect(() => {
    if (orphaned) {
      void signOutAndClearCache();
    }
  }, [orphaned]);

  if (loading || (user && profileLoading)) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải…</p>
      </main>
    );
  }

  if (!user || orphaned) {
    // Giữ đúng đích để đăng nhập xong quay lại (khách bấm link dòng họ từ
    // Facebook không bị mất trang muốn xem). Truyền qua ?next= để trang login
    // đọc được — state.from không đủ vì OAuth redirect làm mất state.
    const dest = location.pathname + location.search;
    const to =
      dest && dest !== "/"
        ? `/login?next=${encodeURIComponent(dest)}`
        : "/login";
    return <Navigate to={to} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
