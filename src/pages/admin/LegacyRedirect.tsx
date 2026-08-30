import { Navigate, useSearchParams } from "react-router-dom";

import { pathForLegacyTab } from "@/lib/adminScreens";

/**
 * Đưa link quản trị kiểu cũ về trang mới.
 *
 * Khu quản trị từng là một trang có dải tab (`/admin?tab=users`,
 * `/admin/cai-dat?tab=ai`). Những link đó đã nằm trong lịch sử trình
 * duyệt và trong tin nhắn ("xem giúp anh cái này"), nên bỏ thẳng là
 * người ta bấm vào và gặp trang trống — mà không hiểu vì sao.
 *
 * `replace` để nút Back không kẹt vòng: bấm Back là về nơi họ đến, chứ
 * không quay lại chính cái link cũ rồi bị đẩy đi tiếp.
 */
export default function LegacyRedirect() {
  const [params] = useSearchParams();
  const to = pathForLegacyTab(params.get("tab")) ?? "/admin";
  return <Navigate to={to} replace />;
}
