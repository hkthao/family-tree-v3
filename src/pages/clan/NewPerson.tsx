import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

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
import { IconCheck, IconCopy, IconPlus, IconX } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import { queryKeys } from "@/lib/queries/keys";
import { track } from "@/lib/analytics";
import { createPerson, getPerson } from "@/lib/queries/persons";
import { EMPTY_PERSON_ADDRESS } from "@/components/PersonAddressCard";
import {
  savePersonAddress,
  type PersonAddressInput,
} from "@/lib/queries/personAddresses";

import { t } from "@lingui/core/macro";
interface NewPersonFormProps {
  clanId: string;
  /** Sao chép từ người này (?from=). */
  fromId?: string | null;
  /** Gọi sau khi lưu xong (không phải "Lưu & thêm nữa"). */
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Form thêm / sao chép người — dùng cho trang /people/new VÀ ngăn kéo bên phải
 * (xem components/panel/PanelHost).
 */
export function NewPersonForm({
  clanId,
  fromId = null,
  onDone,
  onCancel,
}: NewPersonFormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // When ?from=<personId> is present, this is a "copy" flow: fetch the
  // source person and pre-fill every editable field. Photo and family
  // relationships (parents/spouses/children) are intentionally NOT
  // copied — those would point at the same shared records or be wrong
  // for a near-duplicate, so the user wires them up afterwards.
  const { data: source } = useQuery({
    queryKey: queryKeys.person(fromId ?? "", userId),
    queryFn: () => getPerson(fromId!),
    enabled: !!fromId && !!userId,
  });
  const isCopy = !!fromId;

  const [values, setValues] = useState<PersonFormValues>(EMPTY_PERSON_FORM);
  const patch = (p: Partial<PersonFormValues>) =>
    setValues((v) => ({ ...v, ...p }));
  const [formError, setFormError] = useState<string | null>(null);
  // Track whether prefill ran once so re-renders don't clobber user edits
  // if the source query refetches.
  const [prefilled, setPrefilled] = useState(false);
  // Set right before mutate() to tell onSuccess whether to navigate
  // away or reset the form for another entry. Ref instead of state so
  // a re-render between click and mutate doesn't race.
  const andContinueRef = useRef(false);
  // Progressive disclosure — optional fields (tên tự/húy/thuỵ, ngày
  // mất, nơi sinh/an táng, tiểu sử) are hidden by default to keep the
  // form short for the common case of "just add a name + birth year".
  const [showOptional, setShowOptional] = useState(false);
  const [address, setAddress] =
    useState<PersonAddressInput>(EMPTY_PERSON_ADDRESS);

  useEffect(() => {
    if (!source || prefilled) return;
    // Không tự đánh dấu bản sao là Thuỷ tổ (thường là ngoài ý muốn); hai ô chỉ có
    // ở form Sửa cũng không sao chép.
    setValues({
      ...personFormFromPerson(source),
      isRoot: false,
      todoExcluded: false,
      birthOrder: "",
    });
    // Nguồn đã có dữ liệu ở card "Chi tiết bổ sung" thì mở sẵn — giấu dữ liệu đã điền là gây hiểu lầm.
    if (personHasDetails(source)) setShowOptional(true);
    setPrefilled(true);
  }, [source, prefilled]);

  const mutation = useMutation({
    mutationFn: async () => {
      const created = await createPerson({
        clan_id: clanId,
        ...personFormToColumns(values),
      });
      // Nơi ở (tuỳ chọn): lỗi ở đây không được làm mất người vừa tạo.
      try {
        await savePersonAddress(created.id, address);
      } catch (e) {
        toast.error(t`Đã thêm người nhưng chưa lưu được nơi ở`, {
          description: (e as Error).message,
        });
      }
      return created;
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      track("person_added", { copy: isCopy });
      const savedName = values.fullName.trim();
      if (andContinueRef.current) {
        andContinueRef.current = false;
        // Reset the form for the next entry. Keep `isRoot` cleared and
        // gender at the previous choice — a user batch-entering
        // siblings usually keeps gender steady.
        // Giữ giới tính vừa chọn: nhập hàng loạt anh chị em thường cùng giới.
        setValues((v) => ({ ...EMPTY_PERSON_FORM, gender: v.gender }));
        setAddress(EMPTY_PERSON_ADDRESS);
        setFormError(null);
        toast.success(t`Đã thêm. Tiếp tục…`, { description: savedName });
        // Refocus the name input so the user can type immediately.
        document.getElementById("full_name")?.focus();
        return;
      }
      toast.success(isCopy ? t`Đã tạo bản sao` : t`Đã thêm người`, {
        description: savedName,
      });
      onDone();
    },
    onError: (e) =>
      toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });

  if (!user) return null;

  function handleSubmit(e: React.FormEvent, andContinue: boolean) {
    e.preventDefault();
    setFormError(null);
    if (!values.fullName.trim()) return;
    try {
      // Pre-validate so the user sees a clear message before we round-trip
      validatePersonForm(values);
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }
    andContinueRef.current = andContinue;
    mutation.mutate();
  }

  return (
    <div className="space-y-3">
      {isCopy && source && (
        <Alert>
          <AlertDescription>
            Đang sao chép từ <strong>{source.full_name}</strong>. Quan hệ cha mẹ
            / vợ chồng / con không được sao chép — bạn nối lại sau khi lưu.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        <PersonFormFields
          mode="create"
          values={values}
          onChange={patch}
          detailsOpen={showOptional}
          address={address}
          onAddressChange={setAddress}
        />

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
          {!isCopy && (
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending || !values.fullName.trim()}
              onClick={(e) => handleSubmit(e, true)}
              title={t`Lưu rồi tiếp tục thêm người khác (giữ giới tính)`}
            >
              {mutation.isPending && andContinueRef.current ? (
                t`Đang lưu…`
              ) : (
                <>
                  <IconPlus className="h-4 w-4 mr-1.5" />
                  {t`Lưu & thêm nữa`}
                </>
              )}
            </Button>
          )}
          <Button
            type="submit"
            variant="default"
            data-testid="person-submit-button"
            disabled={mutation.isPending || !values.fullName.trim()}
          >
            {mutation.isPending && !andContinueRef.current ? (
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
    </div>
  );
}

export default function NewPerson() {
  const { clanId } = useParams<{ clanId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clan } = useClanContext();
  const fromId = searchParams.get("from");
  const isCopy = !!fromId;
  if (!clanId) return null;
  const back = () => navigate(`/clans/${clanId}/people`);

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: t`Danh bạ`, to: `/clans/${clanId}/people` },
          { label: isCopy ? t`Sao chép người` : t`Thêm người` },
        ]}
      />

      <PageHeader
        icon={
          isCopy ? (
            <IconCopy className="h-7 w-7" />
          ) : (
            <IconPlus className="h-7 w-7" />
          )
        }
        title={isCopy ? t`Sao chép người` : t`Thêm người`}
        description={
          isCopy
            ? t`Tạo bản sao thông tin — không sao chép quan hệ.`
            : t`Thêm 1 người vào dòng họ. Có thể đánh dấu Thuỷ tổ.`
        }
      />
      <NewPersonForm
        clanId={clanId}
        fromId={fromId}
        onDone={back}
        onCancel={back}
      />
    </div>
  );
}
