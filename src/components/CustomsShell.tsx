import { PlatformShell } from "@/components/PlatformShell";

/**
 * Khung trang Sổ tay Văn hoá — nay chỉ là `PlatformShell` với logo trỏ về
 * sổ tay. Giữ tên cũ vì các trang sổ tay đang gọi theo tên này.
 */
export function CustomsShell({ children }: { children: React.ReactNode }) {
  return <PlatformShell homeTo="/so-tay">{children}</PlatformShell>;
}
