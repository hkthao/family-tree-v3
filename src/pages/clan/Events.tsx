import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Events() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Sự kiện</h2>

      <Card>
        <CardHeader>
          <CardTitle>Sắp ra mắt</CardTitle>
          <CardDescription>
            Sinh nhật, ngày giỗ, kỷ niệm — danh sách và lịch tháng. Theo dõi
            qua email/SMS sẽ thêm ở Phase 3 (sau khi có quy đổi âm lịch).
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
