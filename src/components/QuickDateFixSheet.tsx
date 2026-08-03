import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { IconCheck } from "@/components/icons";
import { RelationSheet } from "@/components/RelationSheet";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson, updatePerson } from "@/lib/queries/persons";

interface Props {
  open: boolean;
  onClose: () => void;
  clanId: string;
  personId: string;
  /** From the todo row's `missing` array — drives which inputs render. */
  missing: string[];
}

/**
 * Minimum-viable inline fix for the `missing_dates` category on
 * /todo. Year-only, no calendar / lunar pickers — those live on the
 * full edit page for users who want them. The point here is to
 * close gaps in one tap per row.
 *
 * Shows a year input for whichever side is flagged. We default to
 * solar year (most data is recorded that way); legacy lunar-only
 * records keep working because the full edit page is still one tap
 * away if the user really only knows the lunar year.
 */
export function QuickDateFixSheet({
  open,
  onClose,
  clanId,
  personId,
  missing,
}: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const fixBirth = missing.includes("birth_year");
  const fixDeath = missing.includes("death_year");

  const { data: person } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: open && !!personId,
  });

  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [touched, setTouched] = useState(false);

  // Reset when sheet opens for a new row.
  useEffect(() => {
    if (open) {
      setBirthYear("");
      setDeathYear("");
      setTouched(false);
    }
  }, [open, personId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {};
      if (fixBirth && birthYear.trim()) {
        const y = Number(birthYear);
        if (!Number.isInteger(y) || y < 1 || y > 9999) {
          throw new Error("Năm sinh không hợp lệ");
        }
        // Year-precision solar: pad to YYYY-01-01.
        patch.birth_date = `${String(y).padStart(4, "0")}-01-01`;
        patch.birth_date_precision = "year";
      }
      if (fixDeath && deathYear.trim()) {
        const y = Number(deathYear);
        if (!Number.isInteger(y) || y < 1 || y > 9999) {
          throw new Error("Năm mất không hợp lệ");
        }
        patch.death_date = `${String(y).padStart(4, "0")}-01-01`;
        patch.death_date_precision = "year";
      }
      if (Object.keys(patch).length === 0) {
        throw new Error("Chưa nhập năm nào");
      }
      await updatePerson(personId, patch);
    },
    onSuccess: async () => {
      await invalidateClanData(qc, clanId);
      toast.success("Đã lưu", {
        description: person?.full_name ?? undefined,
      });
      onClose();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (mutation.isPending) return;
    if (
      (fixBirth && !birthYear.trim()) ||
      (fixDeath && !deathYear.trim())
    ) {
      // If only one side is flagged, allow saving with just that one
      // filled — the validation above only fires when both sides are
      // missing AND user left one blank. For single-side rows, fall
      // through to mutate.
      const onlyOne =
        (fixBirth && !fixDeath) || (fixDeath && !fixBirth);
      if (!onlyOne) return;
    }
    mutation.mutate();
  }

  const titleParts: string[] = [];
  if (fixBirth) titleParts.push("năm sinh");
  if (fixDeath) titleParts.push("năm mất");
  const title = `Bổ sung ${titleParts.join(" & ")}`;

  return (
    <RelationSheet
      open={open}
      title={title}
      subtitle={person?.full_name ?? undefined}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5 pb-6">
        {fixBirth && (
          <div className="space-y-2">
            <Label htmlFor="quick_birth_year" required={!fixDeath}>
              Năm sinh
            </Label>
            <Input
              id="quick_birth_year"
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              maxLength={4}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="vd 1942"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Không nhớ chính xác cũng được — gõ năm gần đúng. Để trống nếu
              hoàn toàn không rõ. Cần ngày/tháng âm? Bấm <em>"Sửa
              đầy đủ"</em> bên dưới.
            </p>
          </div>
        )}

        {fixDeath && (
          <div className="space-y-2">
            <Label htmlFor="quick_death_year" required={!fixBirth}>
              Năm mất
            </Label>
            <Input
              id="quick_death_year"
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              maxLength={4}
              value={deathYear}
              onChange={(e) => setDeathYear(e.target.value)}
              placeholder="vd 2018"
              autoFocus={!fixBirth}
            />
          </div>
        )}

        {touched &&
          ((fixBirth && fixDeath && !birthYear.trim() && !deathYear.trim()) ||
            (!fixBirth && fixDeath && !deathYear.trim()) ||
            (fixBirth && !fixDeath && !birthYear.trim())) && (
            <p className="text-sm text-destructive">
              Hãy nhập ít nhất một năm — hoặc đóng nếu chưa rõ.
            </p>
          )}

        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-card border-t flex gap-2 z-10">
          <Button
            type="submit"
            className="flex-1"
            disabled={mutation.isPending}
          >
            <IconCheck className="h-4 w-4 mr-1.5" />
            {mutation.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="shrink-0"
          >
            Đóng
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Cần sửa thêm (ngày, tháng, âm lịch)?{" "}
          <a
            href={`/clans/${clanId}/people/${personId}/edit`}
            className="text-primary hover:underline underline-offset-2"
          >
            Mở trang sửa đầy đủ
          </a>
        </p>
      </form>
    </RelationSheet>
  );
}
