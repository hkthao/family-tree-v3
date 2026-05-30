import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  addChildToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson } from "@/lib/queries/persons";

const SOLO_VALUE = "__solo__";

export default function AddChild() {
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
  const { data: rels } = useQuery({
    queryKey: queryKeys.personRelationships(personId ?? "", userId),
    queryFn: () => getPersonRelationships(personId!),
    enabled: !!personId,
  });

  const [otherParent, setOtherParent] = useState<string>(SOLO_VALUE);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = useState("");
  const [isLiving, setIsLiving] = useState(true);

  const mutation = useMutation({
    mutationFn: async () => {
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
        birth_date: birthDate || null,
        is_living: isLiving,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.personRelationships(personId!, userId),
      });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "persons" &&
          q.queryKey[1] === clanId,
      });
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

        <h1 className="text-3xl font-semibold mb-2">Thêm con</h1>
        {focal && (
          <p className="text-muted-foreground mb-6">Cho {focal.full_name}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (fullName.trim()) mutation.mutate();
          }}
          className="space-y-5"
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

          <div className="space-y-2">
            <Label htmlFor="birth_date">Ngày sinh (tuỳ chọn)</Label>
            <Input
              id="birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
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
              {mutation.isPending ? "Đang lưu…" : "Thêm con"}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`/clans/${clanId}/people/${personId}`}>Hủy</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
