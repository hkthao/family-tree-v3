import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson, updatePerson } from "@/lib/queries/persons";

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
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [burialPlace, setBurialPlace] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!person) return;
    setFullName(person.full_name);
    setGender(person.gender);
    setIsLiving(person.is_living);
    setIsRoot(person.is_root);
    setBirthDate(person.birth_date ?? "");
    setDeathDate(person.death_date ?? "");
    setBirthPlace(person.birth_place ?? "");
    setBurialPlace(person.burial_place ?? "");
    setBio(person.bio ?? "");
  }, [person]);

  const mutation = useMutation({
    mutationFn: () =>
      updatePerson(personId!, {
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
        birth_date: birthDate || null,
        death_date: deathDate || null,
        birth_place: birthPlace || null,
        burial_place: burialPlace || null,
        bio: bio || null,
      }),
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
              if (fullName.trim()) mutation.mutate();
            }}
            className="space-y-5"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Ngày sinh</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="death_date">Ngày mất</Label>
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
