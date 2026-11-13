import { IconBuildings } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { ClansTab } from "@/pages/admin/Clans";

import { t } from "@lingui/core/macro";
export default function DongHoPage() {
  return (
    <AdminShell
      icon={<IconBuildings className="h-7 w-7" />}
      title={t`Dòng họ`}
      description={t`Giới hạn người, tài khoản và lượt trợ lý theo dòng họ.`}
    >
      <ClansTab />
    </AdminShell>
  );
}
