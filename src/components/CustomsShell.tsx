import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

/**
 * Khung trang cho Sổ tay Văn hoá — dùng chung list/detail. Trang này PUBLIC:
 * - Đã đăng nhập: dùng AppHeader + sidebar như các trang trong app.
 * - Khách (chưa đăng nhập): header tối giản (logo + nút Đăng nhập), không
 *   sidebar — để link chia sẻ mở được mà không lộ menu cần đăng nhập.
 */
export function CustomsShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="min-h-dvh bg-background lg:pl-72">
        <AppHeader />
        <main className="container max-w-4xl py-6 px-4 space-y-3">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="container max-w-4xl flex items-center justify-between gap-2 px-4 h-[64px]">
          <Link
            to="/so-tay"
            className="clan-name inline-flex items-center gap-2 text-xl font-semibold text-primary"
          >
            <AppLogo size={28} className="rounded" />
            Dòng Họ Việt
          </Link>
          <Button size="sm" asChild>
            <Link to="/login">Đăng nhập</Link>
          </Button>
        </div>
      </header>
      <main className="container max-w-4xl py-6 px-4 space-y-3">{children}</main>
    </div>
  );
}
