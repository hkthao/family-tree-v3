import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { CalendarDateInput } from "@/components/CalendarDateInput";
import { IconCheck, IconX } from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useToast } from "@/components/Toast";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import {
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  type CalendarDateValue,
} from "@/lib/personDates";
import {
  assignExistingParent,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { createPerson, getPerson, updatePerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

const PICKER_CAP = 1000;

interface AddParentFormProps {
  clanId: string;
  personId: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Embeddable parent form — used by the /add-parent route AND the
 * inline sheet on PersonDetail.
 *
 * For "new" mode:
 *   1. Create the parent person.
 *   2. Find or create the focal's birth_family with that parent in the
 *      appropriate husband/wife slot.
 *   3. Point focal.birth_family_id at the resulting family.
 *
 * For "existing" mode:
 *   Delegate to assign_existing_parent RPC which handles slot picking,
 *   family creation, AND cycle prevention (no descendants-as-parents).
 */
export function AddParentForm({
  clanId,
  personId,
  onSaved,
  onCancel,
}: AddParentFormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: !!personId,
  });
  const { data: rels } = useQuery({
    queryKey: queryKeys.personRelationships(personId, userId),
    queryFn: () => getPersonRelationships(personId),
    enabled: !!personId,
  });

  const hasFather = !!rels?.parents.find((p) => p.gender === "M");
  const hasMother = !!rels?.parents.find((p) => p.gender === "F");
  const defaultRole: "M" | "F" = !hasFather ? "M" : !hasMother ? "F" : "M";

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [role, setRole] = useState<"M" | "F">(defaultRole);
  // Lock-in flag: once the user explicitly picks a role, the
  // defaultRole-sync effect below stops overwriting it. Without this,
  // clicking "Mẹ" with an empty form would immediately snap back to
  // "Cha" because defaultRole resolves to "M" while rels is loading.
  const [roleTouched, setRoleTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [isLiving, setIsLiving] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  if (rels && !roleTouched && role !== defaultRole) {
    setRole(defaultRole);
  }

  const [existingFilter, setExistingFilter] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const { data: clanIndex } = useQuery({
    queryKey: queryKeys.kinshipIndex(clanId, userId),
    queryFn: () => getKinshipIndex(clanId),
    enabled: !!userId && !!clanId && mode === "existing",
    staleTime: 5 * 60_000,
  });

  const { candidates, totalMatched } = useMemo(() => {
    if (!clanIndex || !focal) return { candidates: [], totalMatched: 0 };
    const excluded = new Set<string>([focal.id]);
    for (const p of rels?.parents ?? []) excluded.add(p.id);
    for (const sp of rels?.spouses ?? []) excluded.add(sp.id);
    const matched = clanIndex.ordered
      .filter((p) => !excluded.has(p.id))
      .filter((p) => matchesName(p.full_name, existingFilter));
    return { candidates: matched.slice(0, PICKER_CAP), totalMatched: matched.length };
  }, [clanIndex, focal, rels, existingFilter]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error("Thiếu thông tin");

      if (mode === "existing") {
        if (!existingId) throw new Error("Chưa chọn người để gắn");
        await assignExistingParent(focal.id, existingId);
        return;
      }

      const birthCols = buildPersonDateColumns(birth);
      const parent = await createPerson({
        clan_id: clanId,
        full_name: fullName.trim(),
        gender: role,
        is_living: isLiving,
        birth_date: birthCols.solar_date,
        birth_date_precision: birthCols.solar_precision,
        birth_lunar_year: birthCols.lunar_year,
        birth_lunar_month: birthCols.lunar_month,
        birth_lunar_day: birthCols.lunar_day,
        birth_lunar_is_leap: birthCols.lunar_is_leap,
      });

      const existingOther = rels?.parents.find((p) => p.gender !== role);
      const family = await findOrCreateFamily({
        clanId,
        partnerA: { id: parent.id, gender: role },
        partnerB: existingOther
          ? { id: existingOther.id, gender: existingOther.gender }
          : null,
      });

      await updatePerson(focal.id, { birth_family_id: family.id });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      const label =
        mode === "existing"
          ? clanIndex?.byId.get(existingId ?? "")?.full_name ?? "người đã chọn"
          : fullName.trim();
      toast.success(
        mode === "existing" ? "Đã gắn cha/mẹ" : "Đã thêm cha/mẹ",
        { description: label },
      );
      onSaved();
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        if (mode === "new") {
          if (!fullName.trim()) return;
          try {
            buildPersonDateColumns(birth);
          } catch (err) {
            setFormError((err as Error).message);
            return;
          }
        } else if (!existingId) {
          setFormError("Chọn người trong danh sách để gắn");
          return;
        }
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <SegmentedControl ariaLabel="Chế độ thêm cha/mẹ">
        <SegmentedButton
          active={mode === "new"}
          onClick={() => setMode("new")}
        >
          Người mới
        </SegmentedButton>
        <SegmentedButton
          active={mode === "existing"}
          onClick={() => setMode("existing")}
        >
          Chọn người đã có
        </SegmentedButton>
      </SegmentedControl>

      {mode === "new" ? (
        <>
          <fieldset className="space-y-3">
            <legend className="text-base font-medium mb-2">Vai trò</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={role === "M"}
                  onChange={() => {
                    setRole("M");
                    setRoleTouched(true);
                  }}
                  disabled={hasFather}
                  className="h-4 w-4 accent-primary"
                />
                <span>
                  Cha {hasFather && "(đã có)"}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={role === "F"}
                  onChange={() => {
                    setRole("F");
                    setRoleTouched(true);
                  }}
                  disabled={hasMother}
                  className="h-4 w-4 accent-primary"
                />
                <span>
                  Mẹ {hasMother && "(đã có)"}
                </span>
              </label>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="full_name" required>
              Họ và tên
            </Label>
            <Input
              id="full_name"
              required
              autoFocus
              maxLength={200}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={role === "M" ? "Vd: Nguyễn Văn A" : "Vd: Phạm Thị B"}
            />
          </div>

          <CalendarDateInput
            label="Ngày sinh (tuỳ chọn)"
            idPrefix="birth"
            value={birth}
            onChange={setBirth}
            helperText="Chỉ nhớ năm cũng được. Bấm 'Nhập theo lịch Âm' nếu tài liệu ghi ngày âm."
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
        </>
      ) : (
        <div className="space-y-3">
          <Label>Tìm người đã có trong dòng họ</Label>
          <Input
            value={existingFilter}
            onChange={(e) => setExistingFilter(e.target.value)}
            placeholder="Gõ tên để lọc (không cần dấu)"
          />
          {clanIndex && totalMatched > 0 && (
            <p className="text-xs text-muted-foreground">
              {totalMatched > PICKER_CAP
                ? `Hiện ${PICKER_CAP} / ${totalMatched} kết quả — gõ thêm để thu hẹp.`
                : `Hiện ${totalMatched} kết quả.`}
            </p>
          )}
          <ul className="max-h-80 overflow-y-auto border rounded-md divide-y text-sm bg-card">
            {candidates.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground italic">
                {clanIndex ? "Không có người nào khớp." : "Đang tải…"}
              </li>
            )}
            {candidates.map((p) => {
              const active = p.id === existingId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setExistingId(p.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-muted/50 ${
                      active ? "bg-primary/10" : ""
                    }`}
                  >
                    <PersonAvatar gender={p.gender} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`truncate ${active ? "font-semibold text-primary" : "font-medium"}`}
                        >
                          {p.full_name}
                        </span>
                        {p.birth_year && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {p.birth_year}
                          </span>
                        )}
                      </div>
                    </div>
                    {active && (
                      <IconCheck className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            App chặn nếu người đã chọn là con cháu của {focal?.full_name ?? "người này"} —
            tránh vòng lặp "ông nội là con của cháu". Vai trò cha/mẹ
            được suy ra theo giới tính của người được chọn.
          </p>
        </div>
      )}

      {(formError || mutation.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {formError ?? (mutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-card border-t flex gap-3 z-10">
        <Button
          type="submit"
          className="flex-1 sm:flex-none"
          disabled={
            mutation.isPending ||
            (mode === "new"
              ? !fullName.trim() || (role === "M" ? hasFather : hasMother)
              : !existingId)
          }
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
        <Button
          type="button"
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={onCancel}
        >
          <IconX className="h-4 w-4 mr-1.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
}

export default function AddParent() {
  const { clanId, personId } = useParams<{
    clanId: string;
    personId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQs = searchParams.get("from") === "tree" ? "?from=tree" : "";

  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });

  if (!clanId || !personId) return null;
  const back = `/clans/${clanId}/people/${personId}${fromQs}`;

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={back} />
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">Thêm cha / mẹ</h1>
        {focal && (
          <p className="text-muted-foreground">Cho {focal.full_name}</p>
        )}
      </div>

      <AddParentForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}
