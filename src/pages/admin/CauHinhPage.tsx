import { IconSettings } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { ConfigTab } from "@/pages/admin/Config";

import { t } from "@lingui/core/macro";
export default function CauHinhPage() {
  return (
    <AdminShell
      icon={<IconSettings className="h-7 w-7" />}
      title={t`Cấu hình nền tảng`}
      description={t`Linh vật, dòng họ demo.`}
    >
      <ConfigTab />
    </AdminShell>
  );
}
