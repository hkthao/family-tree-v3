import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AppHeader } from "@/components/AppHeader";
import { IconShield } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  ADMIN_AREA_HINT,
  ADMIN_AREA_LABEL,
  adminPath,
  pathForLegacyTab,
  screensByArea,
  type AdminArea,
} from "@/lib/adminScreens";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

/**
 * Trang chủ khu quản trị — LƯỚI các màn, kiểu màn hình chính điện thoại.
 *
 * Vì sao lưới chứ không phải dải tab: chín màn xếp thành tab thì trên
 * điện thoại phải cuộn ngang mới thấy hết, và cái đang bị che thì coi
 * như không tồn tại. Lưới cho thấy TẤT CẢ trong một màn, mỗi ô một icon
 * to dễ nhắm, và mở ra là một trang riêng có URL riêng.
 *
 * Vẫn giữ hai nhóm "Báo cáo" / "Cài đặt" vì hai nhóm khác hẳn nhịp dùng:
 * một bên mở ra xem, một bên đụng nhầm là hỏng thật.
 */
export default function AdminHub() {
  // `loading` là bắt buộc: lúc mới tải trang, phiên đăng nhập chưa khôi
  // phục xong nên `user` còn null — đá thẳng về /login là admin bấm
  // bookmark vào thẳng trang quản trị thì luôn bị văng ra.
  const { user, loading } = useAuth();
  // Link cũ `/admin?tab=users` → trang mới. Đặt ở đây vì đường dẫn của
  // chúng trùng đúng trang lưới này.
  const [params] = useSearchParams();
  const legacy = pathForLegacyTab(params.get("tab"));
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.myProfile(user?.id ?? ""),
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user?.id,
  });

  usePageTitle("Quản trị nền tảng");

  if (legacy) return <Navigate to={legacy} replace />;
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
      <main className="container max-w-5xl space-y-6 px-4 py-6">
        <PageHeader
          icon={<IconShield className="h-7 w-7" />}
          title="Quản trị nền tảng"
          description="Chọn một mục để mở. Mỗi mục là một trang riêng."
        />
        {(["report", "settings"] as AdminArea[]).map((area) => (
          <section key={area} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{ADMIN_AREA_LABEL[area]}</h2>
              <p className="text-sm text-muted-foreground">
                {ADMIN_AREA_HINT[area]}
              </p>
            </div>
            {/* 2 cột ở điện thoại (ô vẫn đủ to để nhắm), 3–4 ở màn rộng. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {screensByArea(area).map((s) => (
                <li key={s.slug}>
                  <Link
                    to={adminPath(s.slug)}
                    className="flex h-full min-h-[124px] flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {s.icon}
                    </span>
                    <span className="font-medium leading-tight">{s.label}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {s.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
