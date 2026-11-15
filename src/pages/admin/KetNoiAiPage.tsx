import { IconSparkles } from "@/components/icons";
import { ApiTokensAdminTab } from "@/components/admin/ApiTokensAdminTab";
import { AdminShell } from "@/pages/admin/AdminShell";

import { t } from "@lingui/core/macro";
export default function KetNoiAiPage() {
  return (
    <AdminShell
      icon={<IconSparkles className="h-7 w-7" />}
      title={t`Kết nối AI`}
      description={t`Token để AI bên ngoài (Claude, ChatGPT…) tra cứu gia phả; thu hồi khi nghi bị lộ.`}
    >
      <ApiTokensAdminTab />
    </AdminShell>
  );
}
