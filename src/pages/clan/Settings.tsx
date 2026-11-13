import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { CsvExportButton } from "@/components/CsvExportButton";
import { GedcomButtons } from "@/components/GedcomButtons";
import { friendlyError } from "@/components/ErrorState";
import { useToast } from "@/components/Toast";
import {
  CLAN_FEATURES,
  isFeatureEnabled,
  type ClanFeatureKey,
} from "@/lib/clanFeatures";
import {
  IconBook,
  IconCheck,
  IconList,
  IconQrCode,
  IconSettings,
  IconUsers,
} from "@/components/icons";
import { ShareLinksSection } from "@/components/ShareLinksSection";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import {
  ClanDisplayFields,
  clanFormFromClan,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import { updateClan } from "@/lib/queries/clan-update";
import { queryKeys } from "@/lib/queries/keys";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
export default function Settings() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = user?.id ?? "";

  const [values, setValues] = useState<ClanFormValues>(() =>
    clanFormFromClan(clan),
  );

  useEffect(() => {
    setValues(clanFormFromClan(clan));
  }, [clan.id]);

  const mutation = useMutation({
    mutationFn: () =>
      updateClan(clan.id, {
        visibility: values.visibility,
        hide_photos_in_share: values.hide_photos_in_share,
        generation_offset: values.root_is_gen_zero ? 1 : 0,
        display_death_details: values.display_death_details,
        display_living_full_dob: values.display_living_full_dob,
        public_show_tree: values.public_show_tree,
        public_show_heritage: values.public_show_heritage,
        public_show_graves: values.public_show_graves,
        public_show_events: values.public_show_events,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clan(clan.id, userId),
      });
      // Đổi visibility / tên / mô tả phải làm mới MỌI danh sách dòng họ:
      // "Của tôi" + "Cộng đồng" (key[0]==="clans") và tab Quản trị
      // (key[0]==="admin-clans"). Trước đây chỉ invalidate "mine" nên list
      // Cộng đồng + Admin giữ nhãn cũ (vd vẫn "Công khai" sau khi chuyển
      // sang Riêng tư).
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "clans" || q.queryKey[0] === "admin-clans"),
      });
      toast.success(t`Đã lưu cài đặt`);
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  if (!isClanAdmin(clan)) {
    return <Navigate to={`/clans/${clan.id}/people`} replace />;
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Cài đặt dòng họ` },
        ]}
      />
      <PageHeader
        icon={<IconSettings className="h-7 w-7" />}
        title={t`Cài đặt dòng họ`}
        description={t`Cấu hình, share links, xuất dữ liệu, xoá dòng họ.`}
      />

      <FeaturesCard clan={clan} userId={userId} queryClient={queryClient} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t`Hiển thị & quyền xem`}</CardTitle>
            <CardDescription>
              <Trans>
                <Trans>
                  <Trans>
                    Bật/tắt thông tin hiển thị và phần người ngoài được xem.
                    Tên, mô tả, chi và nội dung sổ gia phả sửa ở trang “Thông
                    tin &amp; Sổ gia phả”.
                  </Trans>
                </Trans>
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ClanDisplayFields value={values} onChange={setValues} />

            {mutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(mutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}
            {mutation.isSuccess && (
              <Alert>
                <AlertDescription>{t`Đã lưu.`}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <Button
              size="sm"
              type="submit"
              variant="outline"
              disabled={mutation.isPending}
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
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{t`Quản lý & công cụ`}</CardTitle>
          <CardDescription>
            {t`Lối tắt tới các trang quản lý và xuất dữ liệu.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {[
            {
              title: t`Thông tin & Sổ gia phả`,
              desc: t`Sửa tên, mô tả, chi (nhánh) và soạn lời nói đầu, phả ký, ngoại phả, phụ khảo.`,
              to: `/clans/${clan.id}/so-gia-pha`,
              icon: <IconBook className="h-4 w-4 mr-1.5" />,
              label: t`Mở trang soạn`,
            },
            {
              title: t`Thành viên`,
              desc: t`Mời thêm tài khoản hoặc đổi vai trò. Giới hạn hiện tại: ${clan.max_users} tài khoản (do quản trị nền tảng đặt).`,
              to: `/clans/${clan.id}/members`,
              icon: <IconUsers className="h-4 w-4 mr-1.5" />,
              label: t`Quản lý thành viên`,
            },
            {
              title: t`Nhật ký chỉnh sửa`,
              desc: t`Lịch sử thay đổi với người, gia đình, chi — có thể khôi phục.`,
              to: `/clans/${clan.id}/audit`,
              icon: <IconList className="h-4 w-4 mr-1.5" />,
              label: t`Mở nhật ký`,
            },
            {
              title: t`Xuất QR cá nhân`,
              desc: t`Tạo mã QR cho từng người để in/khắc — quét ra trang cá nhân.`,
              to: `/clans/${clan.id}/qr-export`,
              icon: <IconQrCode className="h-4 w-4 mr-1.5" />,
              label: t`Mở xuất QR`,
            },
          ].map((r) => (
            <div
              key={r.to}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </div>
              <Button size="sm" asChild variant="outline" className="shrink-0">
                <Link to={r.to}>
                  {r.icon}
                  {r.label}
                </Link>
              </Button>
            </div>
          ))}
          <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="font-medium">{t`Xuất / nhập GEDCOM`}</p>
              <p className="text-sm text-muted-foreground">
                Chuẩn trao đổi dữ liệu phả hệ (5.5.1) — đem dữ liệu đi nơi khác
                hoặc nạp từ phần mềm khác. Giữ được cả các trường tiếng Việt
                (tên tự / húy / thụy, ngày âm, ngày giỗ, chi). Chưa có file?
                {t`Dùng`}{" "}
                <Link
                  to={`/clans/${clan.id}/ai-generate`}
                  className="underline"
                >
                  trang sinh prompt AI
                </Link>{" "}
                để tạo file GEDCOM từ mô tả tự do.
              </p>
            </div>
            <GedcomButtons clan={clan} />
          </div>
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="font-medium">{t`Xuất CSV`}</p>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  <Trans>
                    <Trans>
                      Cùng 9 cột với mẫu Nhập từ Excel — xuất ra để chỉnh hàng
                      loạt rồi nhập lại. Các trường ngoài 9 cột (ngày âm, tên
                      tự, ảnh, nơi sinh…) không được mang theo.
                    </Trans>
                  </Trans>
                </Trans>
              </p>
            </div>
            <div className="shrink-0">
              <CsvExportButton clan={clan} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t`Link chia sẻ`}</CardTitle>
          <CardDescription>
            {t`Link công khai cho khách xem cây (đã ẩn người sống), có hạn và thu hồi được.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShareLinksSection clanId={clan.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t`Giới hạn`}</CardTitle>
          <CardDescription>
            {t`Do quản trị nền tảng đặt, không sửa được ở đây.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{t`Số người tối đa trong cây: ${clan.max_persons}`}</p>
          <p>{t`Số tài khoản tối đa: ${clan.max_users}`}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Feature-flags theo dòng họ ───────────────────────────────────

function FeaturesCard({
  clan,
  userId,
  queryClient,
}: {
  clan: { id: string; disabled_features: string[] };
  userId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const toast = useToast();
  const [disabled, setDisabled] = useState<string[]>(
    clan.disabled_features ?? [],
  );
  useEffect(() => {
    setDisabled(clan.disabled_features ?? []);
  }, [clan.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation({
    mutationFn: (next: string[]) =>
      updateClan(clan.id, { disabled_features: next }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.clan(clan.id, userId),
      }),
    onError: (e) => {
      setDisabled(clan.disabled_features ?? []); // hoàn tác optimistic
      toast.error(t`Không lưu được`, { description: friendlyError(e) });
    },
  });

  function toggle(key: ClanFeatureKey, on: boolean) {
    const next = on
      ? disabled.filter((k) => k !== key)
      : [...new Set([...disabled, key])];
    setDisabled(next);
    m.mutate(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t`Tính năng hiển thị`}</CardTitle>
        <CardDescription>
          <Trans>
            <Trans>
              <Trans>
                Tắt bớt tính năng phụ để menu gọn hơn cho dòng họ này. Lõi (Cây,
                Danh bạ, Sự kiện, Hôm nay) luôn bật. Tắt chỉ ẩn khỏi menu — dữ
                liệu cũ vẫn còn, bật lại là hiện.
              </Trans>
            </Trans>
          </Trans>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CLAN_FEATURES.map((f) => {
          const on = isFeatureEnabled(disabled, f.key);
          return (
            <label
              key={f.key}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => toggle(f.key, e.target.checked)}
                disabled={m.isPending}
                className="mt-1 h-5 w-5 accent-primary shrink-0"
              />
              <div>
                <p className="font-medium">{f.label}</p>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
