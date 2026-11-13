import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { BookMetaFields } from "@/components/BookMetaFields";
import {
  ClanBasicFields,
  ClanDisplayFields,
  clanFormFromClan,
  clanFormToColumns,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import { BookTextsSection } from "@/components/BookTextsSection";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BranchesSection } from "@/components/BranchesSection";
import { friendlyError } from "@/components/ErrorState";
import { IconBook, IconCheck } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  canEditClan,
  isClanAdmin,
  useClanContext,
} from "@/hooks/useClanContext";
import {
  EMPTY_BOOK_TEXTS,
  cleanBookTexts,
  getClanBookTexts,
  saveClanBookTexts,
  type ClanBookTexts,
} from "@/lib/queries/clan-book";
import { updateClan } from "@/lib/queries/clan-update";
import { queryKeys } from "@/lib/queries/keys";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
/**
 * Trang "Thông tin & Sổ gia phả": sửa thông tin dòng họ (tên, mô tả, viền
 * avatar), các chi, và các phần văn bản của sổ gia phả PDF. Công tắc bật/tắt
 * hiển thị nằm ở Cài đặt dòng họ.
 */
export default function BookInfo() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = user?.id ?? "";

  const [values, setValues] = useState<ClanFormValues>(() =>
    clanFormFromClan(clan),
  );
  const [meta, setMeta] = useState<ClanBookTexts>(EMPTY_BOOK_TEXTS);
  const { data: savedMeta } = useQuery({
    queryKey: ["clan-book-texts", clan.id],
    queryFn: () => getClanBookTexts(clan.id),
  });

  useEffect(() => {
    setValues(clanFormFromClan(clan));
  }, [clan.id]);
  useEffect(() => {
    setMeta(savedMeta ?? EMPTY_BOOK_TEXTS);
  }, [savedMeta]);

  const admin = isClanAdmin(clan);

  const mutation = useMutation({
    mutationFn: async () => {
      // Cột dòng họ chỉ quản trị ghi được (RLS); người biên tập chỉ lưu phần sổ.
      if (admin) {
        const { description, ...cols } = clanFormToColumns(values);
        await updateClan(clan.id, {
          ...cols,
          description: description ?? null,
        });
      }
      await saveClanBookTexts(
        clan.id,
        cleanBookTexts({
          place_line: meta.place_line,
          origin_place: meta.origin_place,
          ancestral_hall: meta.ancestral_hall,
          ancestor_anniversary: meta.ancestor_anniversary,
          chief_name: meta.chief_name,
          compilers: meta.compilers,
          compiled_year: meta.compiled_year,
          contact: meta.contact,
        }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clan(clan.id, userId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["clan-book-texts", clan.id],
      });
      // Đổi tên/mô tả phải làm mới mọi danh sách dòng họ (Của tôi, Cộng đồng, Quản trị).
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "clans" || q.queryKey[0] === "admin-clans"),
      });
      toast.success(t`Đã lưu thông tin dòng họ`);
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: friendlyError(e) }),
  });

  if (!canEditClan(clan)) {
    return <Navigate to={`/clans/${clan.id}/people`} replace />;
  }
  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Thông tin & Sổ gia phả` },
        ]}
      />
      <PageHeader
        icon={<IconBook className="h-7 w-7" />}
        title={t`Thông tin & Sổ gia phả`}
        description={t`Sửa thông tin dòng họ và soạn nội dung cho sổ gia phả PDF.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t`Thông tin dòng họ`}</CardTitle>
          <CardDescription>
            {admin
              ? t`Cùng bộ ô với lúc tạo dòng họ.`
              : t`Chỉ quản trị dòng họ sửa được tên, mô tả và tuỳ chọn hiển thị; bạn sửa được thông tin cho sổ.`}
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!admin || values.name.trim()) mutation.mutate();
          }}
        >
          <CardContent className="space-y-5">
            <ClanBasicFields
              value={values}
              onChange={setValues}
              disabled={!admin}
              idPrefix="edit"
            />
            <fieldset className="space-y-3">
              <legend className="text-base font-medium mb-1">{t`Thông tin cho sổ gia phả`}</legend>
              <BookMetaFields value={meta} onChange={setMeta} idPrefix="edit" />
            </fieldset>
            <ClanDisplayFields
              value={values}
              onChange={setValues}
              disabled={!admin}
            />
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <Button
              type="submit"
              variant="outline"
              disabled={mutation.isPending || (admin && !values.name.trim())}
            >
              {mutation.isPending ? (
                t`Đang lưu…`
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-1.5" />
                  {t`Lưu thay đổi`}
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t`Chi (nhánh)`}</CardTitle>
          <CardDescription>{t`Các chi/nhánh của dòng họ. Mỗi người có thể thuộc một chi.`}</CardDescription>
        </CardHeader>
        <CardContent>
          <BranchesSection clanId={clan.id} canEdit={admin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t`Nội dung Sổ gia phả`}</CardTitle>
          <CardDescription>
            <Trans>
              <Trans>
                <Trans>
                  Lời nói đầu, phả ký, ngoại phả, phụ khảo trong sổ gia phả PDF.
                  Phần để trống sẽ không in. Phả hệ, phả đồ, ngày giỗ, cưới gả
                  tự dựng từ dữ liệu.
                </Trans>
              </Trans>
            </Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookTextsSection
            clanId={clan.id}
            clanName={clan.name}
            canEdit={canEditClan(clan)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
