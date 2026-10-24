import { openDocument } from "zmp-sdk";

import { supabase } from "@/lib/supabase";

// Tệp tĩnh cho các bản PDF, đóng gói cùng Mini App (trang web lấy ở "/fonts/…").
import font400 from "../../public/fonts/be-vietnam-pro-400.ttf?url";
import font600 from "../../public/fonts/be-vietnam-pro-600.ttf?url";
import logo from "../../public/icons/app-icon-192.png";
import avatarF from "../../public/avatars/female.png";
import avatarM from "../../public/avatars/male.png";
import dragon from "../../public/watermarks/dragon.png";
import phoenix from "../../public/watermarks/phoenix.png";

/**
 * PDF trong Mini App — dùng chung cho Sổ gia phả và Báo cáo Quỹ họ.
 *
 * Bộ dựng PDF của web lấy phông/ảnh theo đường dẫn "/fonts/…" của trang
 * web; ở đây trỏ sang bản đóng gói cùng Mini App. Trong Zalo không tải file
 * kiểu trình duyệt được, nên file được đẩy lên kho riêng tư `book-exports`
 * (mỗi người một thư mục) rồi mở bằng trình xem tài liệu của Zalo qua địa
 * chỉ có chữ ký, hết hạn sau một giờ.
 */
export async function preparePdfAssets(): Promise<void> {
  const { setPdfAssets } = await import("@/lib/pdf/pdfAssets");
  setPdfAssets({ font400, font600, logo, avatarM, avatarF, watermarks: { dragon, phoenix } });
}

/** Lưu PDF vào `book-exports/<userId>/<name>.pdf` (ghi đè), trả địa chỉ có chữ ký. */
export async function savePdf(blob: Blob, userId: string, name: string, filename: string): Promise<string> {
  const path = `${userId}/${name}.pdf`;
  const up = await supabase.storage.from("book-exports").upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);
  const signed = await supabase.storage.from("book-exports").createSignedUrl(path, 60 * 60, { download: filename });
  if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message ?? "Không tạo được địa chỉ tải.");
  return signed.data.signedUrl;
}

export function openPdf(url: string, filename: string) {
  return openDocument({ url, title: filename, download: true, share: false, edit: false }).catch(() => {
    // Ngoài Zalo (giả lập máy tính) không có trình xem của Zalo.
    window.open(url, "_blank");
  });
}
