import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AppHeader } from "@/components/AppHeader";
import { IconArrowLeft } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

/**
 * Khung chung cho MỌI màn quản trị.
 *
 * Có nó thì chín màn trông như một bộ: cùng chiều rộng, cùng vị trí tiêu
 * đề, cùng chỗ có nút quay lại. Trước đây tất cả nằm chung một trang có
 * dải tab, nên mỗi màn không có tiêu đề riêng và URL không nói được đang
 * ở đâu.
 *
 * Kiểm quyền đặt ở đây, một chỗ: từng màn tự kiểm là kiểu sớm muộn cũng
 * có màn mới quên kiểm.
 */
export function AdminShell({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  // `loading` là bắt buộc: lúc mới tải trang, phiên đăng nhập chưa khôi
  // phục xong nên `user` còn null — đá thẳng về /login là admin bấm
  // bookmark vào thẳng trang quản trị thì luôn bị văng ra.
  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.myProfile(user?.id ?? ""),
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user?.id,
  });

  usePageTitle(title);

  if (loading || isLoading) {
    return (
      <div className="min-h-dvh bg-background lg:pl-72">
        <AppHeader />
        <LoadingState />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.is_platform_admin) return <Navigate to="/clans" replace />;

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-5xl space-y-4 px-4 py-6">
        {/* Đường lui rõ ràng: trên điện thoại menu trái đang đóng, không
            có dòng này thì phải mở menu mới quay về được. */}
        <Link
          to="/admin"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Quản trị nền tảng
        </Link>
        <PageHeader icon={icon} title={title} description={description} />
        {children}
      </main>
    </div>
  );
}
