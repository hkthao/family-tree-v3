import { Navigate, useLocation, useParams } from "react-router-dom";

import { shareBase } from "@/lib/shareUrls";

/** /s/:token (địa chỉ ngắn của link cây) → trang dòng họ /share/:token. nginx đã chuyển người thật; route này là dự phòng (dev, ứng dụng cài sẵn). */
export default function ShortShareRedirect() {
  const { token = "" } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`${shareBase(token)}${search}${hash}`} replace />;
}
