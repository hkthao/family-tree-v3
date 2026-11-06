import { useEffect, useState } from "react";

import { CHIP_TONE_CLASS } from "@/components/Chip";
import { HERITAGE_CATEGORY_ICON, HERITAGE_CATEGORY_TONE } from "@/components/heritageCategoryStyle";
import { IconBook } from "@/components/icons";
import type { HeritageCategory } from "@/lib/queries/heritage";

/**
 * Ảnh đại diện mục di sản. Nếu chưa có ảnh hoặc ảnh lỗi (load fail) → hiện
 * icon theo chủ đề. Ảnh dùng lazy-load + cache trình duyệt để giảm tải server.
 */
export function HeritageThumb({
  category,
  src,
  className = "h-16 w-16",
  flush = false,
}: {
  category: HeritageCategory;
  src?: string | null;
  className?: string;
  /** Cao bằng phần nội dung của dòng chứa nó (ô bo góc nằm trong đệm của thẻ) — dùng trong dòng danh sách. */
  flush?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  // Reset trạng thái lỗi khi đổi nguồn ảnh (vd URL ký lại).
  useEffect(() => setErrored(false), [src]);

  const Icon = HERITAGE_CATEGORY_ICON[category] ?? IconBook;
  const tint = CHIP_TONE_CLASS[HERITAGE_CATEGORY_TONE[category] ?? "neutral"];
  const showImg = !!src && !errored;

  return (
    <div
      className={`${flush ? "min-h-14 w-14 self-stretch rounded-lg border" : `${className} rounded-md border`} shrink-0 overflow-hidden grid place-items-center ${showImg ? "bg-muted" : tint}`}
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
        <Icon className={flush ? "h-5 w-5" : "h-6 w-6"} />
      )}
    </div>
  );
}
