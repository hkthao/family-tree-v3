import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signOutAndClearCache } from "@/lib/auth-actions";

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="container max-w-4xl flex items-center justify-between py-3">
        <Link
          to="/clans"
          className="clan-name text-2xl font-semibold text-primary"
        >
          Gia phả
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">
            {user?.user_metadata?.display_name ?? user?.email}
          </span>
          <Button variant="outline" size="sm" onClick={signOutAndClearCache}>
            Đăng xuất
          </Button>
        </div>
      </div>
    </header>
  );
}
