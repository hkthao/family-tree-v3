import { Navigate, useParams } from "react-router-dom";

/**
 * Trang "Công cụ" trung gian đã bỏ: các công cụ trải thẳng ra trang "Tất cả tính năng". Giữ tuyến này để link
 * cũ (bookmark, hướng dẫn) vẫn mở đúng chỗ thay vì 404.
 */
export function ToolsRedirect() {
  const { clanId } = useParams<{ clanId: string }>();
  return <Navigate to={`/clans/${clanId}/menu`} replace />;
}
