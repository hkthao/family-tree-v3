import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { PartialDateInput } from "@/components/PartialDateInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import {
  dateFromParts,
  partsFromDate,
  type DateParts,
} from "@/lib/partialDate";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson, updatePerson } from "@/lib/queries/persons";

const EMPTY_PARTS: DateParts = { year: "", month: "", day: "" };

export default function EditPerson() {
  const { clanId, personId } = useParams<{ clanId: string; personId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: person, isLoading } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [isRoot, setIsRoot] = useState(false);
  const [birth, setBirth] = useState<DateParts>(EMPTY_PARTS);
  const [death, setDeath] = useState<DateParts>(EMPTY_PARTS);
  const [birthPlace, setBirthPlace] = useState("");
  const [burialPlace, setBurialPlace] = useState("");
  const [bio, setBio] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!person) return;
    setFullName(person.full_name);
    setGender(person.gender);
    setIsLiving(person.is_living);
    setIsRoot(person.is_root);
    setBirth(
      partsFromDate({
        date: person.birth_date,
        precision: person.birth_date_precision,
      }),
    );
    setDeath(
      partsFromDate({
        date: person.death_date,
        precision: person.death_date_precision,
      }),
    );
    setBirthPlace(person.birth_place ?? "");
    setBurialPlace(person.burial_place ?? "");
    setBio(person.bio ?? "");
  }, [person]);

  const mutation = useMutation({
    mutationFn: async () => {
      const birthD = dateFromParts(birth);
      const deathD = dateFromParts(death);
      return updatePerson(personId!, {
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
        birth_date: birthD.date,
        birth_date_precision: birthD.precision,
        death_date: deathD.date,
        death_date_precision: deathD.precision,
        birth_place: birthPlace || null,
        burial_place: burialPlace || null,
        bio: bio || null,
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      navigate(`/clans/${clanId}/people/${personId}`);
    },
  });

  if (!clanId || !personId) return null;

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4">
        <nav className="text-sm text-muted-foreground mb-4">
          <Link
            to={`/clans/${clanId}/people/${personId}`}
            className="hover:underline"
          >
            ← Quay lại
          </Link>
        </nav>

        <h1 className="text-3xl font-semibold mb-6">Sửa thông tin</h1>

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        {person && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              if (!fullName.trim()) return;
              try {
                dateFromParts(birth);
                dateFromParts(death);
              } catch (err) {
                setFormError((err as Error).message);
                return;
              }
              mutation.mutate();
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Họ và tên</Label>
              <Input
                id="full_name"
                required
                maxLength={200}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-base font-medium mb-2">Giới tính</legend>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={gender === "M"}
                    onChange={() => setGender("M")}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Nam</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
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
              helperText="Có thể bỏ trống ngày/tháng nếu chỉ biết năm."
            />

            <PartialDateInput
              label="Ngày mất (nếu đã mất)"
              idPrefix="death"
              value={death}
              onChange={(next) => {
                setDeath(next);
                if (next.year) setIsLiving(false);
              }}
            />

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
                  Khi bật, đời = 1; trigger tự cập nhật đời cho con cháu.
                </span>
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="birth_place">Nơi sinh</Label>
              <Input
                id="birth_place"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="burial_place">Nơi an táng</Label>
              <Input
                id="burial_place"
                value={burialPlace}
                onChange={(e) => setBurialPlace(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Tiểu sử</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

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
                size="lg"
                disabled={mutation.isPending || !fullName.trim()}
              >
                {mutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to={`/clans/${clanId}/people/${personId}`}>Hủy</Link>
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
