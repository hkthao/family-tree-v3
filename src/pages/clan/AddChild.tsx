import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { BirthOrderPicker } from "@/components/BirthOrderPicker";
import { CalendarDateInput } from "@/components/CalendarDateInput";
import { IconCheck, IconUserPlus, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
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
import { useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  type CalendarDateValue,
} from "@/lib/personDates";
import {
  addChildToFamily,
  assignPersonToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { getPerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

const PICKER_CAP = 1000;
const SOLO_VALUE = "__solo__";

interface AddChildFormProps {
  clanId: string;
  personId: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Embeddable child form — used by the /add-child route AND the
 * inline sheet on PersonDetail.
 */
export function AddChildForm({
  clanId,
  personId,
  onSaved,
  onCancel,
}: AddChildFormProps) {
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

  // Default to the first spouse — silently leaving the picker on
  // SOLO_VALUE used to create a phantom "parent + null" family unit
  // even when the focal already had a real spouse, which produced
  // an empty "?" placeholder on the tree. User can still flip back
  // to solo for unknown / single-parent cases.
  const [otherParent, setOtherParent] = useState<string>(SOLO_VALUE);
  const [otherParentTouched, setOtherParentTouched] = useState(false);
  useEffect(() => {
    if (otherParentTouched) return;
    const first = rels?.spouses[0];
    if (first && otherParent === SOLO_VALUE) {
      setOtherParent(first.id);
    }
  }, [rels, otherParent, otherParentTouched]);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [isLiving, setIsLiving] = useState(true);
  const [birthOrder, setBirthOrder] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "new" || birthOrder !== "" || !rels) return;
    const next = rels.children.length + 1;
    setBirthOrder(String(next));
  }, [mode, birthOrder, rels]);

  const [existingFilter, setExistingFilter] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const { data: clanIndex } = useQuery({
    queryKey: queryKeys.kinshipIndex(clanId, userId),
    queryFn: () => getKinshipIndex(clanId),
    enabled: !!userId && !!clanId && mode === "existing",
    staleTime: 5 * 60_000,
  });

  const { candidates, totalMatched } = useMemo(() => {
    if (!clanIndex) return { candidates: [], totalMatched: 0 };
    const excluded = new Set<string>([focal?.id ?? ""]);
    for (const sp of rels?.spouses ?? []) excluded.add(sp.id);
    const matched = clanIndex.ordered
      .filter((p) => !excluded.has(p.id))
      .filter((p) => matchesName(p.full_name, existingFilter));
    return { candidates: matched.slice(0, PICKER_CAP), totalMatched: matched.length };
  }, [clanIndex, focal, rels, existingFilter]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error("Thiếu thông tin");

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

      if (mode === "existing") {
        if (!existingId) throw new Error("Chưa chọn người để gắn");
        await assignPersonToFamily(existingId, family.id);
        return { id: existingId };
      }

      const birthCols = buildPersonDateColumns(birth);
      return addChildToFamily({
        clanId,
        family_id: family.id,
        full_name: fullName.trim(),
        gender,
        birth_date: birthCols.solar_date,
        birth_date_precision: birthCols.solar_precision,
        birth_lunar_year: birthCols.lunar_year,
        birth_lunar_month: birthCols.lunar_month,
        birth_lunar_day: birthCols.lunar_day,
        birth_lunar_is_leap: birthCols.lunar_is_leap,
        is_living: isLiving,
        birth_order: birthOrder.trim()
          ? Math.max(1, Math.floor(Number(birthOrder)))
          : null,
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      const label =
        mode === "existing"
          ? clanIndex?.byId.get(existingId ?? "")?.full_name ?? "người đã chọn"
          : fullName.trim();
      toast.success(
        mode === "existing" ? "Đã gắn làm con" : "Đã thêm con",
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
        } else {
          if (!existingId) {
            setFormError("Chọn người trong danh sách để gắn làm con");
            return;
          }
        }
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <SegmentedControl ariaLabel="Chế độ thêm con">
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
      <div className="space-y-2">
        <Label htmlFor="other_parent">Người đồng-cha-mẹ</Label>
        <select
          id="other_parent"
          value={otherParent}
          onChange={(e) => {
            setOtherParent(e.target.value);
            setOtherParentTouched(true);
          }}
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
        {rels?.spouses && rels.spouses.length > 0 &&
          otherParent === SOLO_VALUE && (
            <Alert>
              <AlertDescription>
                {focal?.full_name ?? "Người này"} đã có{" "}
                {rels.spouses.length === 1
                  ? `vợ/chồng (${rels.spouses[0].full_name})`
                  : `${rels.spouses.length} vợ/chồng`}
                {" "}— chọn để con được gắn đúng. Chỉ giữ "đơn thân" nếu
                người con này thực sự không cùng cha mẹ với những anh
                chị em hiện có.
              </AlertDescription>
            </Alert>
          )}
        <p className="text-sm text-muted-foreground">
          Nếu cần một người chưa có trong cây, hãy thêm vợ/chồng trước.
        </p>
      </div>

      {mode === "new" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="full_name" required>
              Tên con
            </Label>
            <Input
              id="full_name"
              data-testid="child-name-input"
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

          <BirthOrderPicker
            value={birthOrder}
            onChange={setBirthOrder}
            helper="App gợi ý dựa trên số con đã có. Sửa nếu cần."
          />

          <CalendarDateInput
            label="Ngày sinh (tuỳ chọn)"
            idPrefix="birth"
            helperText="Chỉ nhớ năm cũng được. Bấm 'Nhập theo lịch Âm' nếu tài liệu ghi ngày âm."
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
              const hasOtherFamily = !!p.father_id || !!p.mother_id;
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
                      {hasOtherFamily && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          Đang có bố/mẹ khác — sẽ ghi đè khi gắn.
                        </p>
                      )}
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
            Người đã chọn sẽ trở thành con của family hiện tại
            ({focal?.full_name}
            {otherParent !== SOLO_VALUE
              ? ` + ${rels?.spouses.find((s) => s.id === otherParent)?.full_name ?? ""}`
              : " — đơn thân"}
            ). Nếu trước đó họ đã có bố/mẹ, dữ liệu cũ sẽ bị thay thế.
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

      <div className="flex gap-3 pt-2 justify-end">
        <Button
          type="submit"
          variant="outline"
          data-testid="child-submit-button"
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
          onClick={onCancel}
        >
          <IconX className="h-4 w-4 mr-1.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
}

export default function AddChild() {
  const { clanId, personId } = useParams<{
    clanId: string;
    personId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQs = searchParams.get("from") === "tree" ? "?from=tree" : "";

  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { clan } = useClanContext();
  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });

  if (!clanId || !personId) return null;
  const back = `/clans/${clanId}/people/${personId}${fromQs}`;

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Danh bạ", to: `/clans/${clanId}/people` },
          { label: focal?.full_name ?? "Người", to: back.split("?")[0] },
          { label: "Thêm con" },
        ]}
      />

      <PageHeader
        icon={<IconUserPlus className="h-7 w-7" />}
        title="Thêm con"
        description={focal ? `Cho ${focal.full_name}` : undefined}
      />

      <AddChildForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}
