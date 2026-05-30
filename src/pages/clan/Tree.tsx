import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Tree() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Cây gia phả</h2>

      <Card>
        <CardHeader>
          <CardTitle>Sắp ra mắt</CardTitle>
          <CardDescription>
            Cây gia phả tương tác (family-chart) với SVG card mobile + bộ lọc
            tuỳ chỉnh (người trung tâm, độ sâu, chi).
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
