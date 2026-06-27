import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AppDrawer } from "@/components/AppDrawer";
import { AppLogo } from "@/components/AppLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeQuickToggle } from "@/components/ThemeQuickToggle";

export function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Nút Back hữu ích khi chạy dạng PWA (không có nút back của trình duyệt).
  // Ẩn ở trang gốc để không "lùi" ra khỏi app.
  const isHome = pathname === "/" || pathname === "/clans";

  return (
    <>
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="container max-w-4xl flex items-center justify-between gap-2 px-4 h-[64px]">
          {!isHome && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Quay lại"
              title="Quay lại"
              className="h-10 w-10 hidden lg:inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
            className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted lg:hidden"
          >
            <span className="text-2xl leading-none" aria-hidden="true">☰</span>
          </button>
          {/* Logo only on mobile — the persistent drawer on lg+
              already shows "Dòng Họ Việt" at top-left, so repeating it in
              the page header creates a visible duplicate. */}
          <Link
            to="/clans"
            className="clan-name text-2xl font-semibold text-primary inline-flex items-center gap-2 lg:hidden"
          >
            <AppLogo size={28} className="rounded" />
            Dòng Họ Việt
          </Link>
          <div className="hidden lg:block flex-1" aria-hidden="true" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeQuickToggle />
          </div>
        </div>
      </header>
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
