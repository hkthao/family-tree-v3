import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/components/Toast";
import { IconCheck, IconPlus, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { useAuth } from "@/hooks/useAuth";
import { createClan } from "@/lib/queries/clans";
import { BookMetaFields } from "@/components/BookMetaFields";
import { BookTextsSection } from "@/components/BookTextsSection";
import {
  ClanBasicFields,
  ClanDisplayFields,
  DEFAULT_CLAN_FORM,
  clanFormToColumns,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import {
  EMPTY_BOOK_TEXTS,
  cleanBookTexts,
  saveClanBookTexts,
  type ClanBookTexts,
} from "@/lib/queries/clan-book";

import { t } from "@lingui/core/macro";
interface NewClanFormProps {
  /** Gọi sau khi tạo xong, nhận id dòng họ mới. */
  onDone: (clanId: string) => void;
  onCancel: () => void;
}

/** Form tạo dòng họ — dùng cho trang /clans/new VÀ ngăn kéo phải (?panel=clan-new). */
export function NewClanForm({ onDone, onCancel }: NewClanFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Cùng bộ ô với form Chỉnh sửa (ClanFormFields + BookMetaFields).
  const [values, setValues] = useState<ClanFormValues>(DEFAULT_CLAN_FORM);
  const [meta, setMeta] = useState<ClanBookTexts>(EMPTY_BOOK_TEXTS);

  const mutation = useMutation({
    mutationFn: async () => {
      const clan = await createClan(clanFormToColumns(values), user!.id);
      // Thông tin biên soạn sổ gia phả: lỗi (vd chưa áp migration) không được
      // làm hỏng việc tạo dòng họ — sửa lại được ở trang Sổ gia phả.
      const clean = cleanBookTexts(meta);
      if (Object.values(clean).some(Boolean)) {
        try {
          await saveClanBookTexts(clan.id, clean);
        } catch (e) {
          toast.error(t`Chưa lưu được thông tin sổ gia phả`, {
            description: t`${(e as Error).message}. Dòng họ đã tạo; bạn nhập lại ở trang Thông tin & Sổ gia phả.`,
          });
        }
      }
      return clan;
    },
    onSuccess: async (clan) => {
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "clans",
      });
      toast.success(t`Đã tạo dòng họ`, { description: values.name });
      onDone(clan.id);
    },
    onError: (e) =>
      toast.error(t`Không tạo được`, { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (values.name.trim()) mutation.mutate();
      }}
      className="space-y-5"
    >
      <ClanBasicFields value={values} onChange={setValues} idPrefix="new" />

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-1">{t`Thông tin cho sổ gia phả`}</legend>
        <p className="text-sm text-muted-foreground">
          {t`Tuỳ chọn, in ở bìa và trang giới thiệu của sổ; điền sau cũng được.`}
        </p>
        <BookMetaFields value={meta} onChange={setMeta} idPrefix="new" />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-1">{t`Nội dung Sổ gia phả`}</legend>
        <p className="text-sm text-muted-foreground">
          {t`Chọn mẫu để có sẵn bài hoàn chỉnh rồi sửa lại; AI soạn theo mô tả dùng được sau khi tạo.`}
        </p>
        <BookTextsSection
          clanName={values.name}
          canEdit
          value={meta}
          onChange={setMeta}
        />
      </fieldset>

      <ClanDisplayFields value={values} onChange={setValues} />

      {mutation.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(mutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <FormActions>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>
          <IconX className="h-4 w-4 mr-1.5" />
          {t`Hủy`}
        </Button>
        <Button
          size="sm"
          type="submit"
          variant="default"
          data-testid="clan-submit-button"
          disabled={mutation.isPending || !values.name.trim()}
        >
          {mutation.isPending ? (
            t`Đang tạo…`
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              {t`Tạo dòng họ`}
            </>
          )}
        </Button>
      </FormActions>
    </form>
  );
}

export default function NewClan() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: t`Dòng họ`, to: "/clans" },
            { label: t`Tạo dòng họ mới` },
          ]}
        />

        <PageHeader
          icon={<IconPlus className="h-7 w-7" />}
          title={t`Tạo dòng họ mới`}
          description={t`Đặt tên và vài thông tin cơ bản — tạo xong là dòng họ rỗng, sẵn sàng thêm Thuỷ tổ.`}
        />

        <NewClanForm
          onDone={(id) => navigate(`/clans/${id}`)}
          onCancel={() => navigate("/clans")}
        />
      </main>
    </div>
  );
}
