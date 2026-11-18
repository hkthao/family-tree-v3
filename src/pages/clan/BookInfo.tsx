import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { BookMetaFields } from "@/components/BookMetaFields";
import {
  ClanBasicFields,
  clanFormFromClan,
  clanFormToColumns,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import { BookTextsSection } from "@/components/BookTextsSection";
import { Breadcrumb } from "@/components/Breadcrumb";
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
      // Chỉ ghi các ô CÓ trên trang này (tên, mô tả) — tuỳ chọn hiển thị và viền avatar nằm ở Cài đặt dòng họ, ghi lại
      // giá trị lúc mở trang sẽ đè thay đổi vừa làm bên đó.
      if (admin) {
        const { name, description } = clanFormToColumns(values);
        await updateClan(clan.id, {
          name,
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
  const saveButton = (
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
  );

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
        description={t`Sửa thông tin dòng họ và soạn nội dung cho sổ gia phả PDF. Chi (nhánh) ở mục riêng trong Tính năng.`}
      />

      {/* Hai thẻ riêng (cơ bản / cho sổ) thay vì một thẻ dài — tuỳ chọn hiển thị ở Cài đặt dòng họ (trùng ô); mỗi thẻ thu gọn được — Card chỉ thu gọn
          khi CardContent là con TRỰC TIẾP, nên <form> bọc NGOÀI các thẻ. Nút Lưu ở thẻ nào cũng lưu cả form. */}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!admin || values.name.trim()) mutation.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t`Thông tin dòng họ`}</CardTitle>
            <CardDescription>
              {admin
                ? t`Tên, mô tả — cùng bộ ô với lúc tạo dòng họ.`
                : t`Chỉ quản trị dòng họ sửa được tên, mô tả và tuỳ chọn hiển thị; bạn sửa được thông tin cho sổ.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ClanBasicFields
              value={values}
              onChange={setValues}
              disabled={!admin}
              idPrefix="edit"
              showFrame={false}
            />
          </CardContent>
          <CardFooter className="justify-end">{saveButton}</CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t`Thông tin cho sổ gia phả`}</CardTitle>
            <CardDescription>
              {t`In ở bìa và trang đầu của sổ gia phả PDF.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <BookMetaFields value={meta} onChange={setMeta} idPrefix="edit" />
          </CardContent>
          <CardFooter className="justify-end">{saveButton}</CardFooter>
        </Card>
      </form>

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
