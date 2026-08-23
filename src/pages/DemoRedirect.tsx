import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";

import { LoadingState } from "@/components/LoadingState";
import { track } from "@/lib/analytics";
import { getDemoClanIds } from "@/lib/queries/platformSettings";

/**
 * `/xem/demo` → chuyển tới dòng họ mẫu đang được cấu hình.
 *
 * Có route này để **landing page tĩnh không phải hard-code UUID**: đổi
 * dòng họ demo ở /admin là landing tự trỏ đúng, không cần deploy lại
 * trang tĩnh. Đây là đích chính của các nút CTA bên landing — cho khách
 * xem sản phẩm trước, thay vì đổ thẳng vào tường đăng nhập (nơi phân
 * tích tháng 8 cho thấy một nửa số phiên rời đi).
 *
 * Chưa cấu hình demo thì về trang đăng ký, chứ không để khách kẹt ở màn
 * hình lỗi.
 */
export default function DemoRedirect() {
  const { data, isLoading } = useQuery({
    queryKey: ["demo-clan-ids"],
    queryFn: () => getDemoClanIds(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) return <LoadingState fullscreen label="Đang mở gia phả mẫu…" />;

  const demoClanId = data?.[0];
  if (!demoClanId) return <Navigate to="/signup" replace />;

  track("demo_view_click");
  return <Navigate to={`/xem/clans/${demoClanId}`} replace />;
}
