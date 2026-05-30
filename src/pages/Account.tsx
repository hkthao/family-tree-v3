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
import { signOutAndClearCache } from "@/lib/auth-actions";

export default function Account() {
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4 space-y-6">
        <h1 className="clan-name text-3xl font-semibold">Tài khoản</h1>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
            <CardDescription>
              {user?.user_metadata?.display_name ?? user?.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Email: {user?.email}</p>
            <p className="italic">
              Đổi tên hiển thị, email, mật khẩu sẽ thêm ở commit tiếp theo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đăng xuất</CardTitle>
            <CardDescription>
              Sẽ xoá cache cục bộ trên máy này (an toàn khi dùng chung máy).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={signOutAndClearCache}>
              Đăng xuất
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
