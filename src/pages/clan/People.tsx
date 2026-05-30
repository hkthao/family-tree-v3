import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useClanContext } from "@/hooks/useClanContext";

export default function People() {
  const { clan } = useClanContext();

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Danh bạ</h2>

      <Card>
        <CardHeader>
          <CardTitle>Sắp ra mắt</CardTitle>
          <CardDescription>
            Danh bạ list + grid view với phân trang phía server và tìm kiếm
            không dấu sẽ có ở commit tiếp theo.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Clan: {clan.name}</p>
          <p>Giới hạn: {clan.max_persons} người</p>
        </CardContent>
      </Card>
    </div>
  );
}
