import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { IconCheck, IconX } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { PartialDateInput } from "@/components/PartialDateInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { dateFromParts, type DateParts } from "@/lib/partialDate";
import {
  addChildToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson } from "@/lib/queries/persons";

const SOLO_VALUE = "__solo__";
const EMPTY_PARTS: DateParts = { year: "", month: "", day: "" };

export default function AddChild() {
  const { clanId, personId } = useParams<{
    clanId: string;
    personId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [searchParams] = useSearchParams();
  const fromQs = searchParams.get("from") === "tree" ? "?from=tree" : "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });
  const { data: rels } = useQuery({
    queryKey: queryKeys.personRelationships(personId ?? "", userId),
    queryFn: () => getPersonRelationships(personId!),
    enabled: !!personId,
  });

  const [otherParent, setOtherParent] = useState<string>(SOLO_VALUE);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [birth, setBirth] = useState<DateParts>(EMPTY_PARTS);
  const [isLiving, setIsLiving] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const birthD = dateFromParts(birth);
      if (!clanId || !focal) throw new Error("Thiếu thông tin");

      // Resolve other parent (a spouse from the list) or null for single parent
      let partnerB: { id: string; gender: "M" | "F" } | null = null;
      if (otherParent !== SOLO_VALUE) {
        const sp = rels?.spouses.find((s) => s.id === otherParent);
        if (sp) partnerB = { id: sp.id, gender: sp.gender };
      }

      const family = await findOrCreateFamily({
        clanId,
        partnerA: { id: focal.id, gender: focal.gender },
        partnerB,
      });

      return addChildToFamily({
        clanId,
        family_id: family.id,
        full_name: fullName.trim(),
        gender,
        birth_date: birthD.date,
        birth_date_precision: birthD.precision,
        is_living: isLiving,
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      toast.success("Đã thêm con", { description: fullName.trim() });
      navigate(`/clans/${clanId}/people/${personId}${fromQs}`);
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  if (!clanId || !personId) return null;

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={`/clans/${clanId}/people/${personId}${fromQs}`} />
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">Thêm con</h1>
        {focal && (
          <p className="text-muted-foreground">Cho {focal.full_name}</p>
        )}
      </div>

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
            <Label htmlFor="other_parent">Người đồng-cha-mẹ</Label>
            <select
              id="other_parent"
              value={otherParent}
              onChange={(e) => setOtherParent(e.target.value)}
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              <option value={SOLO_VALUE}>
                Chưa rõ / đơn thân (chỉ {focal?.full_name ?? "người này"})
              </option>
              {rels?.spouses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Nếu cần một người chưa có trong cây, hãy thêm vợ/chồng trước.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Tên con</Label>
            <Input
              id="full_name"
              required
              autoFocus
              maxLength={200}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Vd: Nguyễn Văn C"
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
              className="h-5 w-5 accent-primary shrink-0"
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
              <Link to={`/clans/${clanId}/people/${personId}${fromQs}`}>
                <IconX className="h-4 w-4 mr-1.5" />
                Hủy
              </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
