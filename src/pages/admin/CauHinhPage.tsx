import { IconSettings } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { ConfigTab } from "@/pages/admin/Config";

export default function CauHinhPage() {
  return (
    <AdminShell
      icon={<IconSettings className="h-7 w-7" />}
      title="Cấu hình nền tảng"
      description="Linh vật, dòng họ demo."
    >
      <ConfigTab />
    </AdminShell>
  );
}
