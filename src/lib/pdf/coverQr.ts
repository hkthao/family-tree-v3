import { makeQrDataUrl } from "@/lib/cards/exportCard";
import { getOrCreateTreeShareLink } from "@/lib/queries/share-links";

/**
 * QR trang bìa → link gia phả công khai (ai cũng xem được, không cần đăng nhập). Lỗi (vd không tạo được link) thì
 * trả undefined, sổ không có QR.
 */
export async function makeCoverQr(clanId: string, origin: string): Promise<string | undefined> {
  try {
    const link = await getOrCreateTreeShareLink(clanId);
    return (await makeQrDataUrl(`${origin}/share/${link.token}`, "#00000000")) ?? undefined;
  } catch {
    return undefined;
  }
}
