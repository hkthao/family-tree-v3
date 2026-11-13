import { IconShield } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { HealthTab } from "@/pages/admin/Health";

import { t } from "@lingui/core/macro";
export default function HeThongPage() {
  return (
    <AdminShell
      icon={<IconShield className="h-7 w-7" />}
      title={t`Hệ thống`}
      description={t`Sức khoẻ database, cron, thông báo gửi hỏng.`}
    >
      <HealthTab />
    </AdminShell>
  );
}
