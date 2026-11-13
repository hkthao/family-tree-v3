import { IconBell } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { AnnouncementsAdminTab } from "@/pages/admin/Announcements";

import { t } from "@lingui/core/macro";
export default function ThongBaoPage() {
  return (
    <AdminShell
      icon={<IconBell className="h-7 w-7" />}
      title={t`Thông báo`}
      description={t`Viết thông báo hiện cho toàn bộ người dùng.`}
    >
      <AnnouncementsAdminTab />
    </AdminShell>
  );
}
