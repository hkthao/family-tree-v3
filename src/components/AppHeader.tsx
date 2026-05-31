import { useState } from "react";
import { Link } from "react-router-dom";

import { AppDrawer } from "@/components/AppDrawer";
import { AppLogo } from "@/components/AppLogo";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container max-w-4xl flex items-center justify-between gap-2 py-3 px-4 min-h-[64px]">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
            className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted lg:hidden"
          >
            <span className="text-2xl leading-none" aria-hidden="true">☰</span>
          </button>
          <Link
            to="/clans"
            className="clan-name text-2xl font-semibold text-primary inline-flex items-center gap-2"
          >
            <AppLogo size={28} className="rounded" />
            Gia phả
          </Link>
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]">
            {user?.user_metadata?.display_name ?? user?.email}
          </span>
        </div>
      </header>
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
