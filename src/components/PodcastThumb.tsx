import { useEffect, useState, type ReactNode } from "react";

/**
 * Ảnh bìa podcast. URL ảnh lấy từ Facebook có chữ ký và HẾT HẠN sau vài ngày (và chết hẳn nếu việc đồng bộ
 * dừng vì token hỏng), nên ảnh lỗi là chuyện thường — khi đó hiện khung dự phòng thay vì icon ảnh vỡ.
 */
export function PodcastThumb({
  src,
  className,
  fallback,
}: {
  src: string | null;
  className: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  // Tập khác (hoặc đồng bộ lại có URL mới) thì thử lại.
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
