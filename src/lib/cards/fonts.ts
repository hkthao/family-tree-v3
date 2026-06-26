// Font cho thiệp. Lưu ý: thiệp xuất ra PNG (html-to-image) nên font phải
// được NẠP trước khi xuất. Các font web (Google) hỗ trợ tiếng Việt được
// nạp động khi mở trình tạo thiệp.
//
// Font THƯ PHÁP tiếng Việt (đủ dấu) không có trên Google Fonts → đặt file
// vào `public/fonts/` và khai @font-face trong src/index.css (xem font id
// "calligraphy"). Nếu chưa có file, sẽ tự lùi về kiểu chữ viết tay.

export interface CardFont {
  id: string;
  label: string;
  /** Giá trị font-family áp cho tiêu đề thiệp. */
  family: string;
}

export const CARD_FONTS: CardFont[] = [
  { id: "classic", label: "Cổ điển", family: '"Times New Roman", Georgia, serif' },
  { id: "elegant", label: "Trang nhã", family: '"Playfair Display", Georgia, serif' },
  { id: "modern", label: "Hiện đại", family: '"Be Vietnam Pro", system-ui, sans-serif' },
  { id: "hand", label: "Viết tay", family: '"Dancing Script", cursive' },
  // Khe THƯ PHÁP: ưu tiên font bundled "SVN-ThuPhap" (đặt vào public/fonts),
  // chưa có thì lùi về Dancing Script.
  { id: "calligraphy", label: "Thư pháp", family: '"SVN-ThuPhap", "Dancing Script", cursive' },
];

export const DEFAULT_CARD_FONT = CARD_FONTS[0].family;

// Các họ font cần đảm bảo đã tải đúng subset (gồm tiếng Việt) trước khi
// xuất ảnh. Font đã bundle qua @fontsource (import ở src/index.css).
const FAMILIES = ['"Playfair Display"', '"Be Vietnam Pro"', '"Dancing Script"'];
// Mẫu chữ có dấu để ép tải đúng subset tiếng Việt.
const SAMPLE = "Dòng họ Nguyễn — Giỗ Tổ ữỗọệ";

/** Bảo đảm font cho thiệp đã sẵn sàng (đúng subset tiếng Việt) để xuất ảnh chuẩn. */
export async function ensureCardFontsLoaded(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.all(
    FAMILIES.map((f) => fonts.load(`700 64px ${f}`, SAMPLE).catch(() => undefined)),
  );
  try {
    await fonts.ready;
  } catch {
    /* bỏ qua */
  }
}
