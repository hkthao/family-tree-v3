import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ExistingPersonPicker } from "@/components/ExistingPersonPicker";
import {
  EMPTY_PERSON_CORE,
  PersonCoreFields,
  personCoreToColumns,
  validatePersonForm,
  type PersonCoreValues,
} from "@/components/PersonFormFields";
import { OptionSelect } from "@/components/ui/select";
import { IconCheck, IconUserPlus, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  assignExistingSpouse,
  findOrCreateFamily,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { createPerson, getPerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";
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
  const [core, setCore] = useState<PersonCoreValues>({
    ...EMPTY_PERSON_CORE,
    gender: defaultGender,
  });
  // Lock-in once the user clicks a gender radio — otherwise the sync
  // effect below would snap it back to the opposite-of-focal default
  // every render.
  const [genderTouched, setGenderTouched] = useState(false);
  const patchCore = (p: Partial<PersonCoreValues>) => {
    if (p.gender !== undefined) setGenderTouched(true);
    setCore((c) => ({ ...c, ...p }));
  };
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
  if (focal && !genderTouched && core.gender !== defaultGender) {
    setCore((c) => ({ ...c, gender: defaultGender }));
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
    return {
      candidates: matched.slice(0, PICKER_CAP),
      totalMatched: matched.length,
    };
  }, [clanIndex, focal, existingFilter]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error(t`Thiếu thông tin`);

      if (mode === "existing") {
        if (!existingId) throw new Error(t`Chưa chọn người để gắn`);
        await assignExistingSpouse(focal.id, existingId);
        return { id: existingId };
      }

      const spouse = await createPerson({
        clan_id: clanId,
        ...personCoreToColumns(core),
      });
      await findOrCreateFamily({
        clanId,
        partnerA: { id: focal.id, gender: focal.gender },
        partnerB: { id: spouse.id, gender: core.gender },
      });
      return spouse;
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      const label =
        mode === "existing"
          ? (clanIndex?.byId.get(existingId ?? "")?.full_name ??
            "người đã chọn")
          : core.fullName.trim();
      toast.success(
        mode === "existing" ? t`Đã gắn vợ/chồng` : t`Đã thêm vợ/chồng`,
        { description: label },
      );
      onSaved();
    },
    onError: (e) =>
      toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        if (mode === "new") {
          if (!core.fullName.trim()) return;
          try {
            validatePersonForm(core);
          } catch (err) {
            setFormError((err as Error).message);
            return;
          }
        } else if (!existingId) {
          setFormError(t`Chọn người trong danh sách để gắn`);
          return;
        }
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <OptionSelect
        label={t`Cách thêm`}
        ariaLabel={t`Chế độ thêm vợ/chồng`}
        value={mode}
        onChange={setMode}
        options={[
          { value: "new", label: t`Người mới` },
          { value: "existing", label: t`Chọn người đã có` },
        ]}
      />

      {mode === "new" ? (
        <PersonCoreFields
          values={core}
          onChange={patchCore}
          namePlaceholder={t`Vd: Nguyễn Thị B`}
          nameTestId="spouse-name-input"
        />
      ) : (
        <ExistingPersonPicker
          intro={t`Nối một người đã có sẵn trong cây làm vợ/chồng (thay vì tạo mới) — tránh trùng người.`}
          label={t`Tìm người đã có (khác giới với ${focal?.full_name ?? t`người gốc`})`}
          outro={t`Không được chọn tổ tiên hoặc con cháu (app sẽ chặn). Người đã chọn sẽ tạo family mới hoặc tái dùng nếu cặp đã ghép.`}
          filter={existingFilter}
          onFilterChange={setExistingFilter}
          candidates={candidates}
          totalMatched={totalMatched}
          cap={PICKER_CAP}
          loaded={!!clanIndex}
          emptyLabel={t`Không có người khớp giới tính + tên.`}
          selectedId={existingId}
          onSelect={setExistingId}
        />
      )}

      {(formError || mutation.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {formError ?? (mutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          <IconX className="h-4 w-4 mr-1.5" />
          {t`Hủy`}
        </Button>
        <Button
          type="submit"
          variant="outline"
          data-testid="spouse-submit-button"
          disabled={
            mutation.isPending ||
            (mode === "new" ? !core.fullName.trim() : !existingId)
          }
        >
          {mutation.isPending ? (
            t`Đang lưu…`
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              {t`Lưu`}
            </>
          )}
        </Button>
      </FormActions>
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
          { label: t`Danh bạ`, to: `/clans/${clanId}/people` },
          { label: focal?.full_name ?? t`Người`, to: back.split("?")[0] },
          { label: t`Thêm vợ / chồng` },
        ]}
      />

      <PageHeader
        icon={<IconUserPlus className="h-7 w-7" />}
        title={t`Thêm vợ / chồng`}
        description={focal ? `Cho ${focal.full_name}` : undefined}
      />

      <AddSpouseForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}
