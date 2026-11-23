import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { ClanBookGroup, ClanMainGroup } from "@/components/ClanFormGroups";
import {
  clanFormFromClan,
  clanFormToColumns,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import { Breadcrumb } from "@/components/Breadcrumb";
import { friendlyError } from "@/components/ErrorState";
import { IconBook, IconCheck } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
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
      await saveClanBookTexts(clan.id, cleanBookTexts(meta));
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
      variant="default"
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

      {/* Cùng bộ card với form Tạo dòng họ (ClanFormGroups); tuỳ chọn hiển thị + viền avatar ở Cài đặt dòng họ. */}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!admin || values.name.trim()) mutation.mutate();
        }}
      >
        <ClanMainGroup
          value={values}
          onChange={setValues}
          disabled={!admin}
          idPrefix="edit"
          desc={
            admin
              ? t`Tên và mô tả dòng họ.`
              : t`Chỉ quản trị dòng họ sửa được tên và mô tả; bạn sửa được phần sổ gia phả bên dưới.`
          }
        />
        <ClanBookGroup
          meta={meta}
          onChange={setMeta}
          clanName={clan.name}
          idPrefix="edit"
          defaultOpen
        />
        <FormActions>{saveButton}</FormActions>
      </form>
    </div>
  );
}
