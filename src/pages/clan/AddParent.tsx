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
  assignExistingParent,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { createPerson, getPerson, updatePerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";
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
  const [core, setCore] = useState<PersonCoreValues>(EMPTY_PERSON_CORE);
  const patchCore = (p: Partial<PersonCoreValues>) =>
    setCore((c) => ({ ...c, ...p }));
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
    return {
      candidates: matched.slice(0, PICKER_CAP),
      totalMatched: matched.length,
    };
  }, [clanIndex, focal, rels, existingFilter]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error(t`Thiếu thông tin`);

      if (mode === "existing") {
        if (!existingId) throw new Error(t`Chưa chọn người để gắn`);
        await assignExistingParent(focal.id, existingId);
        return;
      }

      // Giới tính của cha/mẹ do ô Vai trò quyết định.
      const parent = await createPerson({
        clan_id: clanId,
        ...personCoreToColumns({ ...core, gender: role }),
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
          ? (clanIndex?.byId.get(existingId ?? "")?.full_name ??
            "người đã chọn")
          : core.fullName.trim();
      toast.success(
        mode === "existing" ? t`Đã gắn cha/mẹ` : t`Đã thêm cha/mẹ`,
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
        ariaLabel={t`Chế độ thêm cha/mẹ`}
        value={mode}
        onChange={setMode}
        options={[
          { value: "new", label: t`Người mới` },
          { value: "existing", label: t`Chọn người đã có` },
        ]}
      />

      {mode === "new" ? (
        <>
          <fieldset className="space-y-3">
            <legend className="text-base font-medium mb-2">{t`Vai trò`}</legend>
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
                <span>Cha {hasFather && "(đã có)"}</span>
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
                <span>Mẹ {hasMother && "(đã có)"}</span>
              </label>
            </div>
          </fieldset>

          <PersonCoreFields
            values={core}
            onChange={patchCore}
            showGender={false}
            namePlaceholder={
              role === "M" ? t`Vd: Nguyễn Văn A` : t`Vd: Phạm Thị B`
            }
          />
        </>
      ) : (
        <ExistingPersonPicker
          intro={t`Nối một người đã có sẵn trong cây làm cha/mẹ của người này (thay vì tạo mới) — tránh trùng người.`}
          outro={
            <>
              {t`App chặn nếu người đã chọn là con cháu của`}{" "}
              {focal?.full_name ?? t`người này`} — tránh vòng lặp "ông nội là
              con của cháu". Vai trò cha/mẹ được suy ra theo giới tính của người
              được chọn.
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
          disabled={
            mutation.isPending ||
            (mode === "new"
              ? !core.fullName.trim() || (role === "M" ? hasFather : hasMother)
              : !existingId)
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
          { label: t`Thêm cha / mẹ` },
        ]}
      />

      <PageHeader
        icon={<IconUserPlus className="h-7 w-7" />}
        title={t`Thêm cha / mẹ`}
        description={focal ? `Cho ${focal.full_name}` : undefined}
      />

      <AddParentForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}
