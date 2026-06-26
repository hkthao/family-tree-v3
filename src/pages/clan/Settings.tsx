import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { BranchesSection } from "@/components/BranchesSection";
import { CsvExportButton } from "@/components/CsvExportButton";
import { GedcomButtons } from "@/components/GedcomButtons";
import { useToast } from "@/components/Toast";
import {
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
  const [rootIsGenZero, setRootIsGenZero] = useState(
    clan.generation_offset === 1,
  );
  const [showDeathDetails, setShowDeathDetails] = useState(
    clan.display_death_details,
  );
  const [showLivingFullDob, setShowLivingFullDob] = useState(
    clan.display_living_full_dob,
  );
  // Người xem công khai được xem phần nào (chỉ hiệu lực khi public).
  const [pubTree, setPubTree] = useState(clan.public_show_tree);
  const [pubHeritage, setPubHeritage] = useState(clan.public_show_heritage);
  const [pubGraves, setPubGraves] = useState(clan.public_show_graves);
  const [pubEvents, setPubEvents] = useState(clan.public_show_events);

  useEffect(() => {
    setName(clan.name);
    setDescription(clan.description ?? "");
    setVisibility(clan.visibility);
    setHidePhotosInShare(clan.hide_photos_in_share);
    setRootIsGenZero(clan.generation_offset === 1);
    setShowDeathDetails(clan.display_death_details);
    setShowLivingFullDob(clan.display_living_full_dob);
    setPubTree(clan.public_show_tree);
    setPubHeritage(clan.public_show_heritage);
    setPubGraves(clan.public_show_graves);
    setPubEvents(clan.public_show_events);
  }, [clan.id]);

  const mutation = useMutation({
    mutationFn: () =>
      updateClan(clan.id, {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        hide_photos_in_share: hidePhotosInShare,
        generation_offset: rootIsGenZero ? 1 : 0,
        display_death_details: showDeathDetails,
        display_living_full_dob: showLivingFullDob,
        public_show_tree: pubTree,
        public_show_heritage: pubHeritage,
        public_show_graves: pubGraves,
        public_show_events: pubEvents,
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
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Cài đặt dòng họ" },
        ]}
      />
      <PageHeader
        icon={<IconSettings className="h-7 w-7" />}
        title="Cài đặt dòng họ"
        description="Cấu hình, share links, xuất dữ liệu, xoá dòng họ."
      />

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

            <fieldset className="space-y-3">
              <legend className="text-base font-medium mb-1">
                Người xem công khai được xem
              </legend>
              <p className="text-sm text-muted-foreground">
                Chọn phần nào người ngoài (đã đăng nhập, không phải thành viên)
                xem được.
                {visibility === "private"
                  ? " Cần bật chế độ Công khai ở trên trước."
                  : ""}
              </p>
              <div
                className={
                  visibility === "private"
                    ? "space-y-3 opacity-50 pointer-events-none"
                    : "space-y-3"
                }
              >
                {(
                  [
                    {
                      checked: pubTree,
                      set: setPubTree,
                      label: "Cây gia phả & Danh bạ",
                      desc: "Xem cây gia phả và danh sách thành viên (thông tin nhạy cảm của người sống vẫn được ẩn).",
                    },
                    {
                      checked: pubHeritage,
                      set: setPubHeritage,
                      label: "Di sản & Văn hoá",
                      desc: "Xem từ đường, tục lệ, giai thoại, kỷ vật kèm ảnh.",
                    },
                    {
                      checked: pubGraves,
                      set: setPubGraves,
                      label: "Mộ phần & tro cốt",
                      desc: "Xem nơi an nghỉ, người an nghỉ và ảnh mộ.",
                    },
                    {
                      checked: pubEvents,
                      set: setPubEvents,
                      label: "Sự kiện",
                      desc: "Xem lịch sự kiện dòng họ (giỗ, họp họ, lễ tiết).",
                    },
                  ] as const
                ).map((o) => (
                  <label
                    key={o.label}
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={o.checked}
                      disabled={visibility === "private"}
                      onChange={(e) => o.set(e.target.checked)}
                      className="mt-1 h-5 w-5 accent-primary shrink-0"
                    />
                    <div>
                      <p className="font-medium">{o.label}</p>
                      <p className="text-sm text-muted-foreground">{o.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-base font-medium mb-2">
                Cách đánh số đời
              </legend>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rootIsGenZero}
                  onChange={(e) => setRootIsGenZero(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-primary shrink-0"
                />
                <div>
                  <p className="font-medium">Thủy tổ là Đời 0</p>
                  <p className="text-sm text-muted-foreground">
                    Mặc định Thủy tổ là Đời 1, con cháu là Đời 2, 3, 4…
                    Bật tuỳ chọn này nếu dòng họ quen tính Thủy tổ là
                    Đời 0 — con cháu sẽ là Đời 1, 2, 3… Chỉ thay đổi
                    cách hiển thị, không động vào dữ liệu gốc.
                  </p>
                </div>
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-base font-medium mb-2">
                Hiển thị trên cây &amp; sổ gia phả
              </legend>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeathDetails}
                  onChange={(e) => setShowDeathDetails(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-primary shrink-0"
                />
                <div>
                  <p className="font-medium">
                    Người đã mất: hiện ngày giỗ và tuổi thọ
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Thẻ người đã mất trên cây và trong sách PDF hiện
                    thêm ngày giỗ (âm lịch) và tuổi thọ (hưởng thọ bao
                    nhiêu tuổi).
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLivingFullDob}
                  onChange={(e) => setShowLivingFullDob(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-primary shrink-0"
                />
                <div>
                  <p className="font-medium">
                    Người sống: hiện đầy đủ ngày-tháng-năm sinh
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Mặc định chỉ hiện năm sinh. Bật để thẻ người còn
                    sống hiện đủ ngày/tháng/năm sinh trên cây và trong
                    sách PDF.
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
                  className="mt-1 h-5 w-5 accent-primary shrink-0"
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

            <div className="flex gap-3 pt-2 justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={mutation.isPending || !name.trim()}
              >
                {mutation.isPending ? (
                  "Đang lưu…"
                ) : (
                  <>
                    <IconCheck className="h-4 w-4 mr-1.5" />
                    Lưu thay đổi
                  </>
                )}
              </Button>
            </div>
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
          <CardTitle>Xuất QR cá nhân</CardTitle>
          <CardDescription>
            Tạo mã QR cho từng người để in/khắc — quét ra trang cá nhân.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to={`/clans/${clan.id}/qr-export`}>
              <IconQrCode className="h-4 w-4 mr-1.5" />
              Mở xuất QR
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
