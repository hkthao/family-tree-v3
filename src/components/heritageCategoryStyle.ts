import type { ComponentType } from "react";

import type { ChipTone } from "@/components/Chip";
import { IconBook, IconFlame, IconHome, IconScroll } from "@/components/icons";
import type { HeritageCategory } from "@/lib/queries/heritage";

/**
 * Icon + màu của từng chủ đề di sản — MỘT nguồn cho cả chip lẫn ô ảnh đại diện,
 * để hai nơi luôn cùng màu, cùng hình.
 */
export const HERITAGE_CATEGORY_ICON: Record<
  HeritageCategory,
  ComponentType<{ className?: string }>
> = {
  place: IconHome, // từ đường / đền / chùa
  custom: IconFlame, // tục lệ / gia phong (hương khói, cúng lễ)
  story: IconBook, // giai thoại / công trạng
  artifact: IconScroll, // tư liệu / kỷ vật
};

export const HERITAGE_CATEGORY_TONE: Record<HeritageCategory, ChipTone> = {
  place: "primary",
  custom: "warning",
  story: "info",
  artifact: "violet",
};
