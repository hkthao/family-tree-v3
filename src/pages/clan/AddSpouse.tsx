import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { IconCheck, IconX } from "@/components/icons";
import { PartialDateInput } from "@/components/PartialDateInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { dateFromParts, type DateParts } from "@/lib/partialDate";
import { findOrCreateFamily } from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { createPerson, getPerson } from "@/lib/queries/persons";

const EMPTY_PARTS: DateParts = { year: "", month: "", day: "" };

export default function AddSpouse() {
  const { clanId, personId } = useParams<{
    clanId: string;
    personId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });

  // Auto-default to opposite gender (covers ~99% of Vietnamese genealogy cases)
  const defaultGender: "M" | "F" = focal?.gender === "M" ? "F" : "M";

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">(defaultGender);
  const [birth, setBirth] = useState<DateParts>(EMPTY_PARTS);
  const [isLiving, setIsLiving] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Refresh gender default once `focal` loads
  if (focal && gender !== defaultGender && fullName === "" && !birth.year) {
    setGender(defaultGender);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clanId || !focal) throw new Error("Thiếu thông tin");
      const birthD = dateFromParts(birth);
      const spouse = await createPerson(
        {
          clan_id: clanId,
          full_name: fullName.trim(),
          gender,
          is_living: isLiving,
          birth_date: birthD.date,
          birth_date_precision: birthD.precision,
        },
      );
      await findOrCreateFamily({
        clanId,
        partnerA: { id: focal.id, gender: focal.gender },
        partnerB: { id: spouse.id, gender },
      });
      return spouse;
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      navigate(`/clans/${clanId}/people/${personId}`);
    },
  });

  if (!clanId || !personId) return null;

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
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

        <h1 className="text-3xl font-semibold mb-2">
          Thêm vợ / chồng
        </h1>
        {focal && (
          <p className="text-muted-foreground mb-6">
            Cho {focal.full_name}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            if (!fullName.trim()) return;
            try {
              dateFromParts(birth);
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
              autoFocus
              maxLength={200}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Vd: Nguyễn Thị B"
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
            label="Ngày sinh (tuỳ chọn)"
            idPrefix="birth"
            value={birth}
            onChange={setBirth}
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
              {mutation.isPending ? (
                "Đang lưu…"
              ) : (
                <>
                  <IconCheck className="h-5 w-5 mr-2" />
                  Thêm vợ/chồng
                </>
              )}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`/clans/${clanId}/people/${personId}`}>
                <IconX className="h-5 w-5 mr-2" />
                Hủy
              </Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

