import { IconBuildings } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { ClansTab } from "@/pages/admin/Clans";

export default function DongHoPage() {
  return (
    <AdminShell
      icon={<IconBuildings className="h-7 w-7" />}
      title="Dòng họ"
      description="Giới hạn người, tài khoản và lượt trợ lý theo dòng họ."
    >
      <ClansTab />
    </AdminShell>
  );
}
