import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { user } = useAuth();

  return (
    <main className="min-h-dvh p-6">
      <div className="container max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="clan-name text-3xl font-semibold">Gia phả</h1>
          <p className="text-muted-foreground">
            Xin chào, {user?.user_metadata?.display_name ?? user?.email}.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Phase 0 hoàn tất</CardTitle>
            <CardDescription>
              Đăng nhập / đăng ký hoạt động. Phase 1 sẽ thêm CRUD dòng họ, danh
              bạ, cây gia phả.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Đăng xuất
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
