import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { createPerson } from "@/lib/queries/persons";

export default function NewPerson() {
  const { clanId } = useParams<{ clanId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [isRoot, setIsRoot] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createPerson({
        clan_id: clanId!,
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
        birth_date: birthDate || null,
        death_date: deathDate || null,
      }),
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      navigate(`/clans/${clanId}/people`);
    },
  });

  if (!clanId || !user) return null;

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4">
        <nav className="text-sm text-muted-foreground mb-4">
          <Link to={`/clans/${clanId}/people`} className="hover:underline">
            ← Danh bạ
          </Link>
        </nav>

        <h1 className="text-3xl font-semibold mb-6">Thêm người</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (fullName.trim()) mutation.mutate();
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">Họ và tên</Label>
            <Input
              id="full_name"
              required
              autoFocus
              maxLength={200}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Vd: Nguyễn Văn A"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium mb-2">Giới tính</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="M"
                  checked={gender === "M"}
                  onChange={() => setGender("M")}
                  className="h-4 w-4 accent-primary"
                />
                <span>Nam</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="F"
                  checked={gender === "F"}
                  onChange={() => setGender("F")}
                  className="h-4 w-4 accent-primary"
                />
                <span>Nữ</span>
              </label>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Ngày sinh (dương lịch)</Label>
              <Input
                id="birth_date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="death_date">Ngày mất (nếu đã mất)</Label>
              <Input
                id="death_date"
                type="date"
                value={deathDate}
                onChange={(e) => {
                  setDeathDate(e.target.value);
                  if (e.target.value) setIsLiving(false);
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!isLiving}
              onChange={(e) => setIsLiving(!e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            <span>Đã mất</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isRoot}
              onChange={(e) => setIsRoot(e.target.checked)}
              className="mt-1 h-5 w-5 accent-primary"
            />
            <span>
              <span className="font-medium">Thuỷ tổ</span>
              <span className="block text-sm text-muted-foreground">
                Đánh dấu khi đây là gốc của dòng họ (đời 1). Có thể có nhiều
                Thuỷ tổ nếu nhiều chi tách lập.
              </span>
            </span>
          </label>

          {mutation.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {(mutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending || !fullName.trim()}
            >
              {mutation.isPending ? "Đang lưu…" : "Thêm"}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`/clans/${clanId}/people`}>Hủy</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
