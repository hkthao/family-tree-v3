// Kho thiệp chia sẻ — kiểu dữ liệu dùng chung cho registry mẫu + dialog.

export type CardFormat = "square" | "vertical";

export type CardGenre = "memorial" | "story" | "invite";

export const CARD_GENRE_LABEL: Record<CardGenre, string> = {
  memorial: "Tưởng niệm / Giỗ Tổ",
  story: "Câu chuyện / Giai thoại",
  invite: "Khoe gia phả & Mời",
};

/** Kích thước gốc (px) theo định dạng — xuất ảnh ở đúng cỡ này. */
export const CARD_DIMENSIONS: Record<CardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  vertical: { w: 1080, h: 1920 },
};

/** Dữ liệu một tấm thiệp — tự điền từ mục di sản / số liệu dòng họ. */
export interface CardData {
  clanName: string;
  title: string;
  excerpt: string;
  /** Ảnh đã chuyển sang data URL (tránh taint canvas khi xuất). */
  photoDataUrl: string | null;
  /** QR (data URL) trỏ về app — quét để xem di sản / gia phả. */
  qrDataUrl: string | null;
  /** Dòng phụ: ngày âm/dương, "Đời thứ…", … (tuỳ mẫu). */
  dateText?: string | null;
  /** Số liệu khoe gia phả: "12 đời · 348 người" (mẫu mời tham gia). */
  statText?: string | null;
}

export interface CardTemplateProps {
  data: CardData;
  format: CardFormat;
}
