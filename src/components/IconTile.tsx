import type { ComponentType } from "react";

import { CHIP_TONE_CLASS, type ChipTone } from "@/components/Chip";

/**
 * Ô icon bo góc bên trái dòng danh sách (cùng kiểu ô ảnh đại diện của Di sản / Mộ phần):
 * nằm trong phần đệm của dòng, cao bằng phần nội dung, tô cùng tông với chip của dòng đó.
 * Dùng cho dòng không có ảnh (Quỹ họ, Bảng vàng…).
 */
export function IconTile({
  icon: Icon,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: ChipTone;
}) {
  return (
    <div
      aria-hidden="true"
      className={`grid min-h-14 w-14 shrink-0 place-items-center self-stretch rounded-lg border ${CHIP_TONE_CLASS[tone]}`}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}
