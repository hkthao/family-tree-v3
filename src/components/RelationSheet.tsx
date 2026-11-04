import { SidePanel } from "@/components/SidePanel";

interface RelationSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: "md" | "lg";
  children: React.ReactNode;
}

/**
 * Giữ tên cũ cho các nơi nhúng form quan hệ / sửa người (Chi tiết người, Cây,
 * Việc làm…). Nay hiển thị là ngăn kéo bên phải (SidePanel): mobile full màn
 * hình, desktop cột bên phải — có bảo vệ dữ liệu chưa lưu.
 */
export function RelationSheet(props: RelationSheetProps) {
  return <SidePanel {...props} />;
}
