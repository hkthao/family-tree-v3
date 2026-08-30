import { IconScroll } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { GiaPhaImportTab } from "@/pages/admin/GiaPha";

export default function NhapGiaPhaPage() {
  return (
    <AdminShell
      icon={<IconScroll className="h-7 w-7" />}
      title="Nhập gia phả"
      description="Nhập dữ liệu từ nguồn ngoài vào một dòng họ."
    >
      <GiaPhaImportTab />
    </AdminShell>
  );
}
