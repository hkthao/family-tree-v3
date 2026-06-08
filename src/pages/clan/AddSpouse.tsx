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
  assignExistingSpouse,
  findOrCreateFamily,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { createPerson, getPerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

const PICKER_CAP = 1000;

interface AddSpouseFormProps {
  clanId: string;
  personId: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Embeddable spouse form — used by the /add-spouse route AND by the
 * inline sheet on PersonDetail. Caller controls navigation via
 * onSaved / onCancel.
 */
export function AddSpouseForm({
  clanId,
  personId,
  onSaved,
  onCancel,
}: AddSpouseFormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: !!personId,
  });

  const defaultGender: "M" | "F" = focal?.gender === "M" ? "F" : "M";

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">(defaultGender);
  // Lock-in once the user clicks a gender radio — otherwise the sync
  // effect below would snap it back to the opposite-of-focal default
  // every render.
  const [genderTouched, setGenderTouched] = useState(false);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [isLiving, setIsLiving] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const [existingFilter, setExistingFilter] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const { data: clanIndex } = useQuery({
    queryKey: queryKeys.kinshipIndex(clanId, userId),
    queryFn: () => getKinshipIndex(clanId),
    enabled: !!userId && !!clanId && mode === "existing",
    staleTime: 5 * 60_000,
  });

  // Refresh gender default once `focal` loads
  if (focal && !genderTouched && gender !== defaultGender) {
    setGender(defaultGender);
  }

  // Eligible candidates: opposite gender of focal, not focal himself,
  // not already a spouse. Server still enforces ancestor/descendant
  // cycle guards. Diacritic-insensitive match so "Hung"/"Hùng" both
  // find "Hùng".
  const { candidates, totalMatched } = useMemo(() => {
    if (!clanIndex || !focal) return { candidates: [], totalMatched: 0 };
    const oppositeGender = focal.gender === "M" ? "F" : "M";
    const matched = clanIndex.ordered
      .filter((p) => p.id !== focal.id && p.gender === oppositeGender)
      .filter((p) => matchesName(p.full_name, existingFilter));
    return { candidates: matched.slice(0, PICKER_CAP), totalMatched: matched.length };
  }, [clanIndex, focal, existingFilter]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error("Thiếu thông tin");

      if (mode === "existing") {
        if (!existingId) throw new Error("Chưa chọn người để gắn");
        await assignExistingSpouse(focal.id, existingId);
        return { id: existingId };
      }

      const birthCols = buildPersonDateColumns(birth);
      const spouse = await createPerson({
        clan_id: clanId,
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        birth_date: birthCols.solar_date,
        birth_date_precision: birthCols.solar_precision,
        birth_lunar_year: birthCols.lunar_year,
        birth_lunar_month: birthCols.lunar_month,
        birth_lunar_day: birthCols.lunar_day,
        birth_lunar_is_leap: birthCols.lunar_is_leap,
      });
      await findOrCreateFamily({
        clanId,
        partnerA: { id: focal.id, gender: focal.gender },
        partnerB: { id: spouse.id, gender },
      });
      return spouse;
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      const label =
        mode === "existing"
          ? clanIndex?.byId.get(existingId ?? "")?.full_name ?? "người đã chọn"
          : fullName.trim();
      toast.success(
        mode === "existing" ? "Đã gắn vợ/chồng" : "Đã thêm vợ/chồng",
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
      <SegmentedControl ariaLabel="Chế độ thêm vợ/chồng">
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
                  onChange={() => {
                    setGender("M");
                    setGenderTouched(true);
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span>Nam</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={gender === "F"}
                  onChange={() => {
                    setGender("F");
                    setGenderTouched(true);
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span>Nữ</span>
              </label>
            </div>
          </fieldset>

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
          <Label>
            Tìm người đã có (khác giới với {focal?.full_name ?? "người gốc"})
          </Label>
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
                {clanIndex
                  ? "Không có người khớp giới tính + tên."
                  : "Đang tải…"}
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
            Không được chọn tổ tiên hoặc con cháu (app sẽ chặn). Người
            đã chọn sẽ tạo family mới hoặc tái dùng nếu cặp đã ghép.
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
            (mode === "new" ? !fullName.trim() : !existingId)
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

export default function AddSpouse() {
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

      <h1 className="text-2xl font-semibold">Thêm vợ / chồng</h1>
      {focal && (
        <p className="text-muted-foreground mb-6">Cho {focal.full_name}</p>
      )}

      <AddSpouseForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}
