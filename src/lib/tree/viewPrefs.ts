import { useCallback, useState } from "react";

import {
  AVATAR_STYLE_KEY,
  readAvatarStyle,
  type AvatarStyle,
} from "@/lib/familyChartAdapter";
import { NAME_FONT_KEY, readNameFontId } from "@/lib/tree/nameFonts";

/**
 * Tuỳ chọn hiển thị cây gia phả DÙNG CHUNG cho trang Cây (đã đăng nhập) và trang Chia sẻ
 * (công khai): khoá lưu trữ, kiểu dữ liệu, hàm đọc, và hook `useTreeViewPrefs`. Thêm một
 * tuỳ chọn mới = thêm vào đây + `TreeOptionsPanel`; cả hai trang tự có.
 */

/** Hình nền sau biểu đồ cây 2D: chỉ một hình, người xem tự chọn (mặc định phượng). */
export type Backdrop = "phoenix" | "dragon" | "none";
export const BACKDROP_KEY = "family-tree:tree-backdrop";
export function readBackdrop(): Backdrop {
  try {
    const v = localStorage.getItem(BACKDROP_KEY);
    return v === "dragon" || v === "none" ? v : "phoenix";
  } catch {
    return "phoenix";
  }
}

/** Khung viền thẻ: "royal" = viền vàng kép + hoa văn góc; "simple" = viền mảnh. */
export type CardFrame = "royal" | "simple";
export const CARD_FRAME_KEY = "family-tree:card-frame";
export function readCardFrame(): CardFrame {
  try {
    return localStorage.getItem(CARD_FRAME_KEY) === "simple" ? "simple" : "royal";
  } catch {
    return "royal";
  }
}

/** Kiểu thẻ: "wide" = ngang (ảnh trái, chữ phải); "tall" = dọc (hẹp, xem được nhiều người). */
export type CardLayout = "wide" | "tall";
export const CARD_LAYOUT_KEY = "family-tree:card-layout";
export function readCardLayout(): CardLayout {
  try {
    return localStorage.getItem(CARD_LAYOUT_KEY) === "wide" ? "wide" : "tall";
  } catch {
    return "tall";
  }
}

/** Thẻ dọc: ẩn ảnh đại diện cho gọn (mặc định ẩn). */
export const CARD_AVATAR_KEY = "family-tree:card-avatar";
export function readCardAvatar(): boolean {
  try {
    return localStorage.getItem(CARD_AVATAR_KEY) === "on";
  } catch {
    return false;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — ignore */
  }
}

export interface TreeViewPrefs {
  backdrop: Backdrop;
  setBackdrop: (v: Backdrop) => void;
  cardFrame: CardFrame;
  setCardFrame: (v: CardFrame) => void;
  cardLayout: CardLayout;
  setCardLayout: (v: CardLayout) => void;
  cardAvatar: boolean;
  setCardAvatar: (v: boolean) => void;
  nameFont: string;
  setNameFont: (v: string) => void;
  avatarStyle: AvatarStyle;
  setAvatarStyle: (v: AvatarStyle) => void;
}

/**
 * Trạng thái + lưu localStorage của các tuỳ chọn hiển thị. Mỗi setter GHI NGAY (không chờ
 * effect) để cây 3D / Thư mục — đọc localStorage lúc render — thấy giá trị mới ở lần dựng lại.
 */
export function useTreeViewPrefs(): TreeViewPrefs {
  const [backdrop, setBackdropState] = useState<Backdrop>(readBackdrop);
  const [cardFrame, setCardFrameState] = useState<CardFrame>(readCardFrame);
  const [cardLayout, setCardLayoutState] = useState<CardLayout>(readCardLayout);
  const [cardAvatar, setCardAvatarState] = useState<boolean>(readCardAvatar);
  const [nameFont, setNameFontState] = useState<string>(readNameFontId);
  const [avatarStyle, setAvatarStyleState] = useState<AvatarStyle>(readAvatarStyle);

  const setBackdrop = useCallback((v: Backdrop) => {
    write(BACKDROP_KEY, v);
    setBackdropState(v);
  }, []);
  const setCardFrame = useCallback((v: CardFrame) => {
    write(CARD_FRAME_KEY, v);
    setCardFrameState(v);
  }, []);
  const setCardLayout = useCallback((v: CardLayout) => {
    write(CARD_LAYOUT_KEY, v);
    setCardLayoutState(v);
  }, []);
  const setCardAvatar = useCallback((v: boolean) => {
    write(CARD_AVATAR_KEY, v ? "on" : "off");
    setCardAvatarState(v);
  }, []);
  const setNameFont = useCallback((v: string) => {
    write(NAME_FONT_KEY, v);
    setNameFontState(v);
  }, []);
  const setAvatarStyle = useCallback((v: AvatarStyle) => {
    write(AVATAR_STYLE_KEY, v);
    setAvatarStyleState(v);
  }, []);

  return {
    backdrop,
    setBackdrop,
    cardFrame,
    setCardFrame,
    cardLayout,
    setCardLayout,
    cardAvatar,
    setCardAvatar,
    nameFont,
    setNameFont,
    avatarStyle,
    setAvatarStyle,
  };
}
