import { IconBell } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { AnnouncementsAdminTab } from "@/pages/admin/Announcements";

export default function ThongBaoPage() {
  return (
    <AdminShell
      icon={<IconBell className="h-7 w-7" />}
      title="Thông báo"
      description="Viết thông báo hiện cho toàn bộ người dùng."
    >
      <AnnouncementsAdminTab />
    </AdminShell>
  );
}
