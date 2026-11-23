import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Callout } from "@/components/ui/callout";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  TimelineFields,
  draftsToRows,
  rowsToDrafts,
  type TimelineDraft,
} from "@/components/TimelineFields";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import {
  EMPTY_PERSON_FORM,
  PersonFormFields,
  personFormFromPerson,
  personFormToColumns,
  personHasDetails,
  validatePersonForm,
  type PersonFormValues,
} from "@/components/PersonFormFields";
import { IconCheck, IconPencil, IconUndo, IconX } from "@/components/icons";
import { PhotoUploadField } from "@/components/PhotoUploadField";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { PersonRelationsQuick } from "@/components/PersonRelationsQuick";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  canEditClan,
  effectiveRole,
  useClanContext,
} from "@/hooks/useClanContext";
import { useFormDraft } from "@/hooks/useFormDraft";
import { track } from "@/lib/analytics";
import { invalidateClanData } from "@/lib/cache";
import { queryKeys } from "@/lib/queries/keys";
import { bioTimelineRows, yearOf } from "@/lib/personTimeline";
import { getPerson, updatePerson } from "@/lib/queries/persons";
import { EMPTY_PERSON_ADDRESS } from "@/components/PersonAddressCard";
import {
  getPersonAddress,
  savePersonAddress,
  type PersonAddressInput,
} from "@/lib/queries/personAddresses";
import {
  getPersonTimeline,
  replacePersonTimeline,
} from "@/lib/queries/person-timeline";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
interface EditPersonFormProps {
  clanId: string;
  personId: string;
  onSaved: () => void;
  onCancel: () => void;
  /**
   * Chế độ xem nhanh (Danh bạ): cùng form nhưng khoá mọi ô, không nút thêm nào; thanh nút chỉ còn
   * MỘT nút chuyển sang trang chi tiết (nơi sửa, thêm quan hệ…).
   */
  readOnly?: boolean;
}

/**
 * Embeddable edit form — used by the /edit route AND by the inline
 * sheet on /tree so users can fix a card without losing their place
 * in the tree.
 */
export function EditPersonForm({
  clanId,
  personId,
  onSaved,
  onCancel,
  readOnly = false,
}: EditPersonFormProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const toast = useToast();

  // Chế độ xem: người ngoài dòng họ công khai chỉ đọc được view đã che (giống trang chi tiết).
  const { clan } = useClanContext();
  const personSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data: person, isLoading } = useQuery({
    queryKey: [...queryKeys.person(personId, userId), personSource],
    queryFn: () => getPerson(personId, undefined, personSource),
    enabled: !!personId,
  });

  // Dòng thời gian chỉ có ở dòng họ lịch sử; lưu cùng nút "Lưu" của form.
  const isHistorical = clan.kind === "historical";
  const { data: savedTimeline } = useQuery({
    queryKey: ["person-timeline", personId],
    queryFn: () => getPersonTimeline(personId),
    enabled: !!personId && isHistorical,
  });
  const [timeline, setTimeline] = useState<TimelineDraft[] | null>(null);

  // Nơi ở hiện tại (tuỳ chọn, chỉ thành viên dòng họ xem được) — bảng riêng person_addresses.
  const { data: savedAddress, isSuccess: addressLoaded } = useQuery({
    queryKey: ["person-address", personId],
    queryFn: () => getPersonAddress(personId),
    enabled: !!personId && !!person && effectiveRole(clan) !== null,
  });
  const [address, setAddress] =
    useState<PersonAddressInput>(EMPTY_PERSON_ADDRESS);
  const [addressTouched, setAddressTouched] = useState(false);
  useEffect(() => {
    if (!addressLoaded) return;
    setAddress(
      savedAddress
        ? {
            province_code: savedAddress.province_code,
            ward_code: savedAddress.ward_code,
            street_detail: savedAddress.street_detail,
          }
        : EMPTY_PERSON_ADDRESS,
    );
    setAddressTouched(false);
  }, [addressLoaded, savedAddress]);

  const [values, setValues] = useState<PersonFormValues>(EMPTY_PERSON_FORM);
  const patch = (p: Partial<PersonFormValues>) =>
    setValues((v) => ({ ...v, ...p }));
  const [formError, setFormError] = useState<string | null>(null);
  // Progressive disclosure for the optional fields. Auto-opens when
  // any of them is already filled so existing data isn't hidden after
  // the person loads.
  const [showOptional, setShowOptional] = useState(readOnly);

  // Draft persistence — debounce-saves form state into localStorage
  // so a network drop / accidental tab close doesn't nuke half an
  // hour of work. Restoration is opt-in via the banner so the user
  // isn't surprised by stale values.
  const formState = values;
  const { existing: existingDraft, clearDraft } = useFormDraft({
    key: `edit-person:${personId}`,
    current: formState,
    // Chế độ xem không ghi / không đề nghị khôi phục bản nháp.
    enabled: !!person && !readOnly,
  });
  const [draftDismissed, setDraftDismissed] = useState(false);

  function restoreDraft() {
    if (!existingDraft) return;
    const d = existingDraft.data;
    setValues({ ...EMPTY_PERSON_FORM, ...d });
    setDraftDismissed(true);
    clearDraft();
  }

  function dismissDraft() {
    setDraftDismissed(true);
    clearDraft();
  }

  useEffect(() => {
    if (!person) return;
    setValues(personFormFromPerson(person));
    if (personHasDetails(person)) setShowOptional(true);
  }, [person]);

  // Nạp dòng thời gian một lần: mốc đã lưu, không có thì dựng tạm từ tiểu sử.
  useEffect(() => {
    if (
      !person ||
      !isHistorical ||
      savedTimeline === undefined ||
      timeline !== null
    )
      return;
    const rows =
      savedTimeline.length > 0
        ? savedTimeline
        : bioTimelineRows(
            person.bio,
            yearOf(person.birth_date),
            yearOf(person.death_date),
          );
    setTimeline(rowsToDrafts(rows));
  }, [person, isHistorical, savedTimeline, timeline]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Kiểm tra dòng thời gian trước khi ghi bất cứ gì.
      const timelineRows =
        isHistorical && timeline !== null ? draftsToRows(timeline) : null;
      return updatePerson(personId, {
        ...personFormToColumns(values),
        todo_excluded: values.todoExcluded,
        birth_order: values.birthOrder.trim()
          ? Math.max(1, Math.floor(Number(values.birthOrder)))
          : null,
      }).then(async (res) => {
        if (timelineRows) {
          await replacePersonTimeline(personId, clanId, timelineRows);
          await queryClient.invalidateQueries({
            queryKey: ["person-timeline", personId],
          });
        }
        // Chỉ ghi khi người dùng đã đụng vào thẻ "Nơi ở hiện tại".
        if (addressTouched) {
          await savePersonAddress(personId, address);
          await queryClient.invalidateQueries({
            queryKey: ["person-address", personId],
          });
          await queryClient.invalidateQueries({
            queryKey: ["clan-map-stats", clanId],
          });
        }
        return res;
      });
    },
    onSuccess: async () => {
      track("person_edited");
      clearDraft();
      await invalidateClanData(queryClient, clanId);
      toast.success(t`Đã lưu thay đổi`);
      onSaved();
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t`Đang tải…`}</p>;
  }
  if (!person) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        if (!values.fullName.trim()) return;
        try {
          validatePersonForm(values);
        } catch (err) {
          setFormError((err as Error).message);
          return;
        }
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <ReadOnlyFieldset readOnly={readOnly} className="space-y-6">
        {existingDraft && !draftDismissed && !readOnly && (
          <Callout
            tone="warning"
            title={t`Có bản nháp chưa lưu`}
            action={
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={restoreDraft}
                >
                  <IconUndo className="mr-1.5 h-4 w-4" />
                  {t`Khôi phục`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={dismissDraft}
                  title={t`Bỏ bản nháp`}
                  aria-label={t`Bỏ bản nháp`}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            }
          >
            <Trans>
              {formatDraftAge(existingDraft.savedAt)} · Bạn đã sửa hồ sơ này
              nhưng chưa bấm Lưu lần trước.
            </Trans>
          </Callout>
        )}

        <PersonFormFields
          mode="edit"
          values={values}
          onChange={patch}
          readOnly={readOnly}
          detailsOpen={showOptional}
          photoSlot={
            <div
              className={`space-y-2 ${readOnly ? "[&_button]:hidden [&_p]:hidden" : ""}`}
            >
              <Label>{t`Ảnh đại diện`}</Label>
              <PhotoUploadField
                clanId={clanId}
                personId={personId}
                gender={values.gender}
                photoPath={person.photo_path ?? null}
              />
            </div>
          }
          timelineSlot={
            isHistorical && timeline !== null ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t`Các mốc trong đời người, từ lúc sinh đến lúc mất. Mốc “Sinh” và “Mất” tự thêm từ ngày sinh, ngày mất.`}
                </p>
                <div className={readOnly ? "[&_button]:hidden" : ""}>
                  <TimelineFields drafts={timeline} onChange={setTimeline} />
                </div>
              </div>
            ) : undefined
          }
          address={
            effectiveRole(clan) !== null && addressLoaded ? address : undefined
          }
          onAddressChange={(next) => {
            setAddress(next);
            setAddressTouched(true);
          }}
        />

        {(formError || mutation.error) && (
          <Alert variant="destructive">
            <AlertDescription>
              {formError ?? (mutation.error as Error).message}
            </AlertDescription>
          </Alert>
        )}
      </ReadOnlyFieldset>

      {readOnly && <PersonRelationsQuick clanId={clanId} personId={personId} />}

      {readOnly ? (
        <FormActions>
          {/* Sửa: sang trang chi tiết và MỞ SẴN ngăn kéo sửa; thêm cha mẹ / vợ chồng / con… làm ở trang chi tiết. */}
          <Button asChild>
            <Link
              to={
                canEditClan(clan)
                  ? `/clans/${clanId}/people/${personId}?panel=person-edit&pid=${personId}`
                  : `/clans/${clanId}/people/${personId}`
              }
            >
              {canEditClan(clan) ? (
                <>
                  <IconPencil className="h-4 w-4 mr-1.5" />
                  {t`Sửa`}
                </>
              ) : (
                t`Xem chi tiết`
              )}
            </Link>
          </Button>
        </FormActions>
      ) : (
        <FormActions>
          <Button type="button" variant="outline" onClick={onCancel}>
            <IconX className="h-4 w-4 mr-1.5" />
            {t`Hủy`}
          </Button>
          <Button
            type="submit"
            variant="default"
            data-testid="edit-person-submit-button"
            disabled={mutation.isPending || !values.fullName.trim()}
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
      )}
    </form>
  );
}

export default function EditPerson() {
  const { clanId, personId } = useParams<{
    clanId: string;
    personId: string;
  }>();
  const { clan } = useClanContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQs = searchParams.get("from") === "tree" ? "?from=tree" : "";

  if (!clanId || !personId) return null;
  const back = `/clans/${clanId}/people/${personId}${fromQs}`;

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: t`Danh bạ`, to: `/clans/${clanId}/people` },
          { label: t`Người`, to: back.split("?")[0] },
          { label: t`Sửa` },
        ]}
      />

      <PageHeader
        icon={<IconPencil className="h-7 w-7" />}
        title={t`Sửa thông tin`}
      />

      <EditPersonForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}

function formatDraftAge(savedAt: number): string {
  const ageMs = Date.now() - savedAt;
  if (ageMs < 60_000) return t`Vài giây trước`;
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 60) return t`${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t`${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return t`${days} ngày trước`;
}
