import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { IconSparkles } from "@/components/icons";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import { Button } from "@/components/ui/button";
import { getSignedPhotoUrl } from "@/lib/photoUpload";

export interface KhoePerson {
  id: string;
  full_name: string;
  generation: number | null;
  photo_path?: string | null;
}

/**
 * Nút "Khoe" tái dùng — tạo thẻ cá nhân ("Tôi là đời thứ N, dòng họ X") để
 * chia sẻ lên Zalo/Facebook. Đặt ở trang Người, Đường trực hệ, Tổng quan…
 * để mỗi thành viên dễ khoe gốc gác → tăng lan toả.
 *
 * Khi chia sẻ, ảnh thiệp được LƯU lại và tạo link công khai /khoe/:token
 * (hạn ≤ 3 tháng) — QR trên thiệp trỏ về trang khoe hiển thị đúng tấm
 * thiệp đó (không phải trang danh thiếp). `canCreateQr` = là thành viên
 * dòng họ (RLS publish yêu cầu thành viên).
 */
export function KhoeButton({
  clanId,
  clanName,
  genOffset,
  canCreateQr,
  person,
  variant = "default",
  size = "sm",
  className,
  iconOnly = false,
  children,
}: {
  clanId: string;
  clanName: string;
  genOffset: number;
  canCreateQr: boolean;
  person: KhoePerson;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
  /** Chỉ hiện icon (dùng trong dòng danh bạ cạnh nút copy). */
  iconOnly?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const { data: photoUrl } = useQuery({
    queryKey: ["khoe-photo", person.photo_path],
    queryFn: () => getSignedPhotoUrl(person.photo_path ?? null),
    enabled: open && !!person.photo_path,
  });

  const genLabel =
    person.generation !== null
      ? `Đời thứ ${person.generation - genOffset}`
      : null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Khoe — tạo thẻ cá nhân chia sẻ"
        title="Tạo thẻ cá nhân để khoe lên Zalo/Facebook"
      >
        <IconSparkles className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-1.5"} />
        {iconOnly ? null : children ?? "Khoe"}
      </Button>

      <ShareCardDialog
        open={open}
        onClose={() => setOpen(false)}
        clanName={clanName}
        shareUrl=""
        initialTitle={person.full_name}
        initialExcerpt=""
        photoUrls={photoUrl ? [photoUrl] : []}
        dateText={genLabel}
        defaultGenre="personal"
        publish={
          canCreateQr
            ? {
                clanId,
                personId: person.id,
                subtitle: genLabel ? `${genLabel} · ${clanName}` : clanName,
              }
            : undefined
        }
      />
    </>
  );
}
