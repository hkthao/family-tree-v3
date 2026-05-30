import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Navigate } from "react-router-dom";

import { useClanContext } from "@/hooks/useClanContext";

export default function Settings() {
  const { clan } = useClanContext();

  if (clan.myRole !== "admin") {
    return <Navigate to={`/clans/${clan.id}/people`} replace />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Cài đặt dòng họ</h2>

      <Card>
        <CardHeader>
          <CardTitle>Sắp ra mắt</CardTitle>
          <CardDescription>
            Đổi tên, mô tả, chế độ hiển thị (riêng tư / công khai), quản lý
            thành viên, tạo / thu hồi share-link.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Tên: {clan.name}</p>
          <p>Chế độ: {clan.visibility === "public" ? "Công khai" : "Riêng tư"}</p>
          <p>Giới hạn: {clan.max_persons} người, {clan.max_users} tài khoản</p>
        </CardContent>
      </Card>
    </div>
  );
}
