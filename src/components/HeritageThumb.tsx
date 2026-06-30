import { useEffect, useState } from "react";

import {
  IconBook,
  IconBuildings,
  IconCamera,
  IconUsers,
} from "@/components/icons";
import type { HeritageCategory } from "@/lib/queries/heritage";

/** Mỗi chủ đề một icon riêng để nhận biết nhanh khi không có/không tải được ảnh. */
const CATEGORY_ICON: Record<
  HeritageCategory,
  React.ComponentType<{ className?: string }>
> = {
  place: IconBuildings, // từ đường / đền / chùa
  custom: IconUsers, // tục lệ / gia phong
  story: IconBook, // giai thoại / công trạng
  artifact: IconCamera, // tư liệu / kỷ vật
};

/**
 * Ảnh đại diện mục di sản. Nếu chưa có ảnh hoặc ảnh lỗi (load fail) → hiện
 * icon theo chủ đề. Ảnh dùng lazy-load + cache trình duyệt để giảm tải server.
 */
export function HeritageThumb({
  category,
  src,
  className = "h-16 w-16",
}: {
  category: HeritageCategory;
  src?: string | null;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  // Reset trạng thái lỗi khi đổi nguồn ảnh (vd URL ký lại).
  useEffect(() => setErrored(false), [src]);

  const Icon = CATEGORY_ICON[category] ?? IconBook;
  const showImg = !!src && !errored;

  return (
    <div
      className={`${className} shrink-0 overflow-hidden rounded-md bg-muted grid place-items-center`}
    >
      {showImg ? (
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon className="h-6 w-6 text-muted-foreground" />
      )}
    </div>
  );
}
