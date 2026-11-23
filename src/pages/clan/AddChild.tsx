import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { BirthOrderPicker } from "@/components/BirthOrderPicker";
import { OtherParentPicker, SOLO_VALUE } from "@/components/OtherParentPicker";
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
  addChildToFamily,
  assignPersonToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { getPerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";
const PICKER_CAP = 1000;

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
  const [core, setCore] = useState<PersonCoreValues>(EMPTY_PERSON_CORE);
  const patchCore = (p: Partial<PersonCoreValues>) =>
    setCore((c) => ({ ...c, ...p }));
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
    return {
      candidates: matched.slice(0, PICKER_CAP),
      totalMatched: matched.length,
    };
  }, [clanIndex, focal, rels, existingFilter]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error(t`Thiếu thông tin`);

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
        if (!existingId) throw new Error(t`Chưa chọn người để gắn`);
        await assignPersonToFamily(existingId, family.id);
        return { id: existingId };
      }

      return addChildToFamily({
        clanId,
        family_id: family.id,
        ...personCoreToColumns(core),
        birth_order: birthOrder.trim()
          ? Math.max(1, Math.floor(Number(birthOrder)))
          : null,
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      const label =
        mode === "existing"
          ? (clanIndex?.byId.get(existingId ?? "")?.full_name ??
            "người đã chọn")
          : core.fullName.trim();
      toast.success(mode === "existing" ? t`Đã gắn làm con` : t`Đã thêm con`, {
        description: label,
      });
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
        } else {
          if (!existingId) {
            setFormError(t`Chọn người trong danh sách để gắn làm con`);
            return;
          }
        }
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <OptionSelect
        label={t`Cách thêm`}
        ariaLabel={t`Chế độ thêm con`}
        value={mode}
        onChange={setMode}
        options={[
          { value: "new", label: t`Người mới` },
          { value: "existing", label: t`Chọn người đã có` },
        ]}
      />
      <OtherParentPicker
        focalName={focal?.full_name ?? t`người này`}
        spouses={rels?.spouses ?? []}
        value={otherParent}
        onChange={(id) => {
          setOtherParent(id);
          setOtherParentTouched(true);
        }}
      />

      {mode === "new" ? (
        <PersonCoreFields
          values={core}
          onChange={patchCore}
          nameLabel={t`Tên con`}
          namePlaceholder={t`Vd: Nguyễn Văn C`}
          nameTestId="child-name-input"
          afterGender={
            <BirthOrderPicker
              value={birthOrder}
              onChange={setBirthOrder}
              helper={t`App gợi ý dựa trên số con đã có. Sửa nếu cần.`}
            />
          }
        />
      ) : (
        <ExistingPersonPicker
          intro={t`Nối một người đã có sẵn trong cây làm con của người này (thay vì tạo mới) — tránh trùng người.`}
          outro={
            <>
              Người đã chọn sẽ trở thành con của family hiện tại (
              {focal?.full_name}
              {otherParent !== SOLO_VALUE
                ? ` + ${rels?.spouses.find((s) => s.id === otherParent)?.full_name ?? ""}`
                : t` — đơn thân`}
              ). Nếu trước đó họ đã có bố/mẹ, dữ liệu cũ sẽ bị thay thế.
            </>
          }
          filter={existingFilter}
          onFilterChange={setExistingFilter}
          candidates={candidates}
          totalMatched={totalMatched}
          cap={PICKER_CAP}
          loaded={!!clanIndex}
          selectedId={existingId}
          onSelect={setExistingId}
          rowNote={(p) =>
            p.father_id || p.mother_id
              ? t`Đang có bố/mẹ khác — sẽ ghi đè khi gắn.`
              : null
          }
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
          data-testid="child-submit-button"
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
          { label: t`Danh bạ`, to: `/clans/${clanId}/people` },
          { label: focal?.full_name ?? t`Người`, to: back.split("?")[0] },
          { label: t`Thêm con` },
        ]}
      />

      <PageHeader
        icon={<IconUserPlus className="h-7 w-7" />}
        title={t`Thêm con`}
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
