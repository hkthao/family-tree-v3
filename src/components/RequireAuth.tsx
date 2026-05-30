import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: React.ReactNode;
}

export function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
