import { toBlob } from "html-to-image";

/**
 * Tải ảnh từ URL (signed URL của Supabase) rồi chuyển sang data URL.
 * Làm vậy để khi xuất thiệp, <img> dùng data URL (cùng nguồn) → KHÔNG bị
 * "taint canvas" do CORS, html-to-image xuất được. Trả null nếu lỗi.
 */
export async function imageUrlToDataUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Tạo QR (data URL) trỏ tới một URL — dùng lib qrcode đã có. */
export async function makeQrDataUrl(text: string | null | undefined): Promise<string | null> {
  if (!text) return null;
  try {
    const QR = (await import("qrcode")).default;
    return await QR.toDataURL(text, {
      margin: 1,
      width: 240,
      color: { dark: "#2B2320", light: "#FFFFFF" },
    });
  } catch {
    return null;
  }
}

/** Render một DOM node (thiệp full-size) thành PNG blob. */
export async function nodeToPngBlob(node: HTMLElement, width: number, height: number): Promise<Blob> {
  const blob = await toBlob(node, {
    width,
    height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
  if (!blob) throw new Error("Không tạo được ảnh thiệp.");
  return blob;
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

/**
 * Chia sẻ ảnh thiệp: ưu tiên navigator.share (mở thẳng Zalo/FB/Messenger
 * trên điện thoại); nếu không hỗ trợ thì tải ảnh về để người dùng tự đăng.
 */
export async function sharePngBlob(
  blob: Blob,
  filename: string,
  text?: string,
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
      // rớt xuống tải ảnh
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
