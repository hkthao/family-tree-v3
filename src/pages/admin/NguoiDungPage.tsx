import { IconUsers } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { AdminShell } from "@/pages/admin/AdminShell";
import { UsersTab } from "@/pages/admin/Users";

export default function NguoiDungPage() {
  const { user } = useAuth();
  return (
    <AdminShell
      icon={<IconUsers className="h-7 w-7" />}
      title="Người dùng"
      description="Tìm người, xem dòng họ của họ, chỉnh giới hạn."
    >
      {/* callerId để màn tự chặn thao tác lên CHÍNH MÌNH (tự khoá tài
          khoản, tự gỡ quyền admin) — AdminShell đã lo phần kiểm quyền. */}
      {user && <UsersTab callerId={user.id} />}
    </AdminShell>
  );
}
