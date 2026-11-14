import { Navigate, useParams } from "react-router-dom";

/**
 * Trang "Hôm nay" cũ đã gộp thành thẻ ở ĐẦU trang Tổng quan. Giữ tuyến này để link cũ (email nhắc giỗ,
 * thông báo đẩy, bookmark) vẫn mở đúng chỗ thay vì 404.
 */
export function TodayRedirect() {
  const { clanId } = useParams<{ clanId: string }>();
  return <Navigate to={`/clans/${clanId}`} replace />;
}
