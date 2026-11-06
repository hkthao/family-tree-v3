import type { ComponentType } from "react";

import type { ChipTone } from "@/components/Chip";
import {
  IconCheck,
  IconCompass,
  IconGrave,
  IconHelp,
  IconHome,
  IconLayers,
  IconRefresh,
  IconTag,
} from "@/components/icons";
import type { RestingPlaceKind, RestingPlaceStatus } from "@/lib/queries/restingPlaces";

type Style = { icon: ComponentType<{ className?: string }>; tone: ChipTone };

/** Icon + màu theo hình thức an nghỉ — dùng chung cho danh sách và ngăn kéo xem nhanh. */
export const RESTING_PLACE_KIND_STYLE: Record<RestingPlaceKind, Style> = {
  grave: { icon: IconGrave, tone: "primary" },
  ashes_temple: { icon: IconHome, tone: "violet" },
  columbarium: { icon: IconLayers, tone: "indigo" },
  scattered: { icon: IconCompass, tone: "teal" },
  other: { icon: IconTag, tone: "neutral" },
};

/** Trạng thái: hiện hữu = xanh; cải táng = vàng; thất lạc = đỏ (cần chú ý). */
export const RESTING_PLACE_STATUS_STYLE: Record<RestingPlaceStatus, Style> = {
  existing: { icon: IconCheck, tone: "success" },
  relocated: { icon: IconRefresh, tone: "warning" },
  lost: { icon: IconHelp, tone: "danger" },
};
