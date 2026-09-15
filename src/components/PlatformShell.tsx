import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { AppLogo } from "@/components/AppLogo";
import { IconLogIn } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

/**
 * Khung trang cho các trang TOÀN NỀN TẢNG (Sổ tay Văn hoá, Podcast…) —
 * thứ không thuộc dòng họ nào.
 *
 * - Đã đăng nhập: AppHeader + chừa chỗ cho menu trái, y như mọi trang khác.
 *   Thiếu phần `lg:pl-72` này là trang nằm đè lên menu — trông như mất menu.
 * - Khách: header tối giản (logo + nút Đăng nhập), không menu — để link chia
 *   sẻ mở được mà không bày ra một menu bấm đâu cũng đòi đăng nhập.
 */
export function PlatformShell({
  children,
  homeTo = "/",
}: {
  children: React.ReactNode;
  /** Logo ở header của khách bấm về đâu. */
  homeTo?: string;
}) {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="min-h-dvh bg-background lg:pl-72">
        <AppHeader />
        <main className="container max-w-4xl space-y-3 px-4 py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="container flex h-[64px] max-w-4xl items-center justify-between gap-2 px-4">
          <Link
            to={homeTo}
            className="clan-name inline-flex items-center gap-2 text-xl font-semibold text-primary"
          >
            <AppLogo size={28} className="rounded" />
            Dòng Họ Việt
          </Link>
          <Button size="sm" asChild>
            <Link to="/login">
              <IconLogIn className="mr-1.5 h-4 w-4" />
              Đăng nhập
            </Link>
          </Button>
        </div>
      </header>
      <main className="container max-w-4xl space-y-3 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
