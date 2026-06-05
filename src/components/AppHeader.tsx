import { useState } from "react";
import { Link } from "react-router-dom";

import { AppDrawer } from "@/components/AppDrawer";
import { AppLogo } from "@/components/AppLogo";
import { ThemeQuickToggle } from "@/components/ThemeQuickToggle";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="container max-w-4xl flex items-center justify-between gap-2 px-4 h-[64px]">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
            className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted lg:hidden"
          >
            <span className="text-2xl leading-none" aria-hidden="true">☰</span>
          </button>
          {/* Logo only on mobile — the persistent drawer on lg+
              already shows "Gia phả" at top-left, so repeating it in
              the page header creates a visible duplicate. */}
          <Link
            to="/clans"
            className="clan-name text-2xl font-semibold text-primary inline-flex items-center gap-2 lg:hidden"
          >
            <AppLogo size={28} className="rounded" />
            Gia phả
          </Link>
          <div className="hidden lg:block flex-1" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]">
              {user?.user_metadata?.display_name ?? user?.email}
            </span>
            <ThemeQuickToggle />
          </div>
        </div>
      </header>
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
