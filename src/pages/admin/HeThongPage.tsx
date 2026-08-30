import { IconShield } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { HealthTab } from "@/pages/admin/Health";

export default function HeThongPage() {
  return (
    <AdminShell
      icon={<IconShield className="h-7 w-7" />}
      title="Hệ thống"
      description="Sức khoẻ database, cron, thông báo gửi hỏng."
    >
      <HealthTab />
    </AdminShell>
  );
}
