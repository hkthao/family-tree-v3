import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { BranchesSection } from "@/components/BranchesSection";
import { CsvExportButton } from "@/components/CsvExportButton";
import { GedcomButtons } from "@/components/GedcomButtons";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconList,
  IconUsers,
} from "@/components/icons";
import { ShareLinksSection } from "@/components/ShareLinksSection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { updateClan } from "@/lib/queries/clan-update";
import { queryKeys } from "@/lib/queries/keys";

export default function Settings() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = user?.id ?? "";

  const [name, setName] = useState(clan.name);
  const [description, setDescription] = useState(clan.description ?? "");
  const [visibility, setVisibility] = useState(clan.visibility);
  const [hidePhotosInShare, setHidePhotosInShare] = useState(
    clan.hide_photos_in_share,
  );

  useEffect(() => {
    setName(clan.name);
    setDescription(clan.description ?? "");
    setVisibility(clan.visibility);
    setHidePhotosInShare(clan.hide_photos_in_share);
  }, [clan.id]);

  const mutation = useMutation({
    mutationFn: () =>
      updateClan(clan.id, {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        hide_photos_in_share: hidePhotosInShare,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clan(clan.id, userId),
      });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "clans" &&
          q.queryKey[1] === "mine",
      });
      toast.success("Đã lưu cài đặt");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  if (!isClanAdmin(clan)) {
    return <Navigate to={`/clans/${clan.id}/people`} replace />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Cài đặt dòng họ</h2>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin</CardTitle>
          <CardDescription>
            Chỉ quản trị clan thấy được trang này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) mutation.mutate();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Tên dòng họ</Label>
              <Input
                id="name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-base font-medium mb-2">Chế độ hiển thị</legend>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                  className="mt-1.5 h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium">Riêng tư</p>
                  <p className="text-sm text-muted-foreground">
                    Chỉ thành viên được mời xem được.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                  className="mt-1.5 h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium">Công khai</p>
                  <p className="text-sm text-muted-foreground">
                    Mọi tài khoản đăng nhập xem được; người còn sống bị ẩn
                    thông tin nhạy cảm.
                  </p>
                </div>
              </label>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-base font-medium mb-2">
                Ảnh trong link chia sẻ
              </legend>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePhotosInShare}
                  onChange={(e) => setHidePhotosInShare(e.target.checked)}
                  className="mt-1.5 h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium">
                    Ẩn ảnh thật khi xem qua link công khai
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Người vào bằng link chia sẻ chỉ thấy ảnh đại diện
                    mặc định (nam/nữ). Thành viên đăng nhập vào dòng họ
                    vẫn thấy ảnh thật như bình thường.
                  </p>
                </div>
              </label>
            </fieldset>

            {mutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(mutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}
            {mutation.isSuccess && (
              <Alert>
                <AlertDescription>Đã lưu.</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending || !name.trim()}
            >
              {mutation.isPending ? (
                "Đang lưu…"
              ) : (
                <>
                  <IconCheck className="h-5 w-5 mr-2" />
                  Lưu thay đổi
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chi (nhánh)</CardTitle>
          <CardDescription>
            Các chi/nhánh của dòng họ. Mỗi người có thể thuộc một chi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BranchesSection clanId={clan.id} canEdit={isClanAdmin(clan)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thành viên</CardTitle>
          <CardDescription>
            Mời thêm tài khoản hoặc đổi vai trò. Giới hạn hiện tại:
            {" "}
            {clan.max_users} tài khoản (do quản trị nền tảng đặt).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={`/clans/${clan.id}/members`}>
              <IconUsers className="h-4 w-4 mr-1.5" />
              Quản lý thành viên
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link chia sẻ</CardTitle>
          <CardDescription>
            Tạo link công khai cho khách xem cây (đã ẩn người sống). Link có
            hạn và thu hồi được bất cứ lúc nào.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShareLinksSection clanId={clan.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Xuất / nhập GEDCOM</CardTitle>
          <CardDescription>
            Chuẩn trao đổi dữ liệu phả hệ (5.5.1) — đem dữ liệu đi nơi
            khác hoặc nạp từ phần mềm khác. Giữ được cả các trường tiếng
            Việt (tên tự / húy / thụy, ngày âm, ngày giỗ, chi). Chưa có
            file? Dùng <Link to={`/clans/${clan.id}/ai-generate`} className="underline">trang sinh prompt AI</Link> để
            tạo file GEDCOM từ mô tả tự do.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GedcomButtons clan={clan} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Xuất CSV</CardTitle>
          <CardDescription>
            Cùng 9 cột với mẫu Nhập từ Excel — xuất ra để chỉnh hàng
            loạt trong Excel/Google Sheets rồi nhập lại. Các trường
            ngoài 9 cột này (ngày âm, tên tự, ảnh, nơi sinh…) không
            được mang theo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CsvExportButton clan={clan} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nhật ký chỉnh sửa</CardTitle>
          <CardDescription>
            Lịch sử thay đổi với người, gia đình, chi — có thể khôi phục.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to={`/clans/${clan.id}/audit`}>
              <IconList className="h-4 w-4 mr-1.5" />
              Mở nhật ký
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giới hạn</CardTitle>
          <CardDescription>
            Do quản trị nền tảng đặt, không sửa được ở đây.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Số người tối đa trong cây: {clan.max_persons}</p>
          <p>Số tài khoản tối đa: {clan.max_users}</p>
        </CardContent>
      </Card>
    </div>
  );
}
