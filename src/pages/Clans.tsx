import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { listMyClans } from "@/lib/queries/clans";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

export default function Clans() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId ?? ""),
    queryFn: () => getMyProfile(userId!),
    enabled: !!userId,
  });
  const isPlatformAdmin = !!profile?.is_platform_admin;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.myClans(userId ?? ""),
    queryFn: () => listMyClans(userId!),
    enabled: !!userId,
  });

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="clan-name text-3xl font-semibold">
            {isPlatformAdmin ? "Tất cả dòng họ" : "Dòng họ của tôi"}
          </h1>
          <Button asChild>
            <Link to="/clans/new">+ Tạo dòng họ</Link>
          </Button>
        </div>

        {isPlatformAdmin && (
          <p className="text-sm text-muted-foreground">
            Bạn đang xem với quyền platform admin: thấy mọi dòng họ trong hệ thống.
          </p>
        )}

        {isLoading && (
          <p className="text-muted-foreground">Đang tải…</p>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6 text-destructive">
              Lỗi: {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {data && data.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Chưa có dòng họ nào</CardTitle>
              <CardDescription>
                Tạo dòng họ đầu tiên để bắt đầu xây dựng gia phả.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/clans/new">Tạo dòng họ</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {data && data.length > 0 && (
          <ul className="space-y-3">
            {data.map((clan) => (
              <li key={clan.id}>
                <Link
                  to={`/clans/${clan.id}`}
                  className="block rounded-lg border bg-card p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h2 className="clan-name text-xl font-semibold truncate">
                        {clan.name}
                      </h2>
                      {clan.description && (
                        <p className="text-muted-foreground text-sm">
                          {clan.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Vai trò: <span className="font-medium">{roleLabel(clan.role)}</span>
                        {" • "}
                        {clan.visibility === "public" ? "Công khai" : "Riêng tư"}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function roleLabel(role: "admin" | "editor" | "viewer"): string {
  return { admin: "Quản trị", editor: "Biên tập", viewer: "Xem" }[role];
}
