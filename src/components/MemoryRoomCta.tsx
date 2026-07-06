import { Link } from "react-router-dom";

import { IconCamera } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Nút CTA sang "Phòng ký ức" (phòng trưng bày ảnh 3D) — dùng chung ở header các
 * trang (Danh bạ, Di sản, Cây gia phả). Chỉ hiện cho thành viên (gate ở nơi gọi).
 * Ẩn chữ trên mobile cho gọn.
 */
export function MemoryRoomCtaButton({
  clanId,
  className,
}: {
  clanId: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={`h-10 px-2.5 sm:px-3 ${className ?? ""}`}
    >
      <Link to={`/clans/${clanId}/memory-room`} title="Phòng ký ức (ảnh 3D)">
        <IconCamera className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Phòng ký ức</span>
      </Link>
    </Button>
  );
}
