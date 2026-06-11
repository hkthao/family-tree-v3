import { useLocation } from "react-router-dom";

import { HelpVideoButton } from "@/components/HelpVideoButton";
import { videoIdForRoute } from "@/lib/helpVideoMap";

/**
 * Tự dò route hiện tại và render <HelpVideoButton> phù hợp. Tránh
 * mỗi page phải tự gắn videoId thủ công.
 *
 * - `<PageHelpVideo />` → icon "?" tròn (header right cluster).
 * - `<PageHelpVideo size="text" />` → text link "Xem hướng dẫn M:SS"
 *   (đặt cạnh tiêu đề trang để in-flow ngay tại thao tác).
 *
 * Tự ẩn nếu route không có video tutorial.
 */
export function PageHelpVideo({
  size = "icon",
}: {
  size?: "icon" | "text";
}) {
  const { pathname } = useLocation();
  const videoId = videoIdForRoute(pathname);
  if (!videoId) return null;
  return <HelpVideoButton videoId={videoId} size={size} />;
}
