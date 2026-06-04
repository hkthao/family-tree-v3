import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { IconCheck, IconX } from "@/components/icons";
import { PartialDateInput } from "@/components/PartialDateInput";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { dateFromParts, type DateParts } from "@/lib/partialDate";
import { createPerson } from "@/lib/queries/persons";

const EMPTY_PARTS: DateParts = { year: "", month: "", day: "" };

export default function NewPerson() {
  const { clanId } = useParams<{ clanId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [isRoot, setIsRoot] = useState(false);
  const [birth, setBirth] = useState<DateParts>(EMPTY_PARTS);
  const [death, setDeath] = useState<DateParts>(EMPTY_PARTS);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const birthD = dateFromParts(birth);
      const deathD = dateFromParts(death);
      return createPerson({
        clan_id: clanId!,
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
        birth_date: birthD.date,
        birth_date_precision: birthD.precision,
        death_date: deathD.date,
        death_date_precision: deathD.precision,
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      toast.success("Đã thêm người", { description: fullName.trim() });
      navigate(`/clans/${clanId}/people`);
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  if (!clanId || !user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim()) return;
    try {
      // Pre-validate so the user sees a clear message before we round-trip
      dateFromParts(birth);
      dateFromParts(death);
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link to={`/clans/${clanId}/people`} className="hover:underline">
          ← Danh bạ
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold">Thêm người</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
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

          <PartialDateInput
            label="Ngày sinh (dương lịch)"
            idPrefix="birth"
            value={birth}
            onChange={setBirth}
            helperText="Có thể bỏ trống ngày, tháng nếu chỉ biết năm (như khắc trên bia mộ)."
          />

          <PartialDateInput
            label="Ngày mất (nếu đã mất)"
            idPrefix="death"
            value={death}
            onChange={(next) => {
              setDeath(next);
              if (next.year) setIsLiving(false);
            }}
            helperText="Để trống nếu còn sống."
          />

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!isLiving}
              onChange={(e) => setIsLiving(!e.target.checked)}
              className="h-5 w-5 accent-primary shrink-0"
            />
            <span>Đã mất</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isRoot}
              onChange={(e) => setIsRoot(e.target.checked)}
              className="mt-1 h-5 w-5 accent-primary shrink-0"
            />
            <span>
              <span className="font-medium">Thuỷ tổ</span>
              <span className="block text-sm text-muted-foreground">
                Đánh dấu khi đây là gốc của dòng họ (đời 1). Có thể có nhiều
                Thuỷ tổ nếu nhiều chi tách lập.
              </span>
            </span>
          </label>

          {(formError || mutation.error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {formError ?? (mutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1 sm:flex-none"
              disabled={mutation.isPending || !fullName.trim()}
            >
              {mutation.isPending ? (
                "Đang lưu…"
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-1.5" />
                  Lưu
                </>
              )}
            </Button>
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link to={`/clans/${clanId}/people`}>
                <IconX className="h-4 w-4 mr-1.5" />
                Hủy
              </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
