import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function App() {
  return (
    <main className="min-h-dvh py-10 px-4">
      <div className="container max-w-2xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="clan-name text-4xl font-semibold">Gia phả</h1>
          <p className="text-muted-foreground">
            Phase 0 — bước 2: shadcn + fonts + theme oxblood
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Demo bảng màu &amp; component</CardTitle>
            <CardDescription>
              Nền giấy ấm, primary oxblood, accent vàng đồng. Người đã mất đánh
              dấu nhã nhặn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Họ và tên</Label>
              <Input id="demo-input" placeholder="Nguyễn Văn A" />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button>Lưu</Button>
              <Button variant="secondary">Hủy</Button>
              <Button variant="outline">Xem trước</Button>
              <Button variant="destructive">Xoá</Button>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nguyễn Văn Tổ</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="text-accent font-medium">Thuỷ tổ</span> •
                    Đời 1
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nguyễn Văn B</p>
                  <p className="text-sm text-muted-foreground">
                    đã mất • 1985 — Đời 3
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nguyễn Thị C</p>
                  <p className="text-sm text-muted-foreground">Đời 4</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
