import { useLocation } from "react-router-dom";

import { HelpVideoButton } from "@/components/HelpVideoButton";
import { videoIdForRoute } from "@/lib/helpVideoMap";

/**
 * Tự dò route hiện tại và render <HelpVideoButton> phù hợp. Tránh
 * mỗi page phải tự gắn videoId thủ công.
 *
 * Drop vào header row của trang:
 *   <h2>Tiêu đề</h2>
 *   <PageHelpVideo />
 *
 * Tự ẩn nếu route không có video tutorial.
 */
export function PageHelpVideo() {
  const { pathname } = useLocation();
  const videoId = videoIdForRoute(pathname);
  if (!videoId) return null;
  return <HelpVideoButton videoId={videoId} />;
}
