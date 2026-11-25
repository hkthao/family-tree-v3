import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { useToast } from "@/components/Toast";
import { InviteCardDialog } from "@/components/community/InviteCardDialog";
import { getOrCreateGeneralInviteUrl } from "@/components/community/inviteLink";

import { t } from "@lingui/core/macro";

/**
 * Mở thẳng "Tạo ảnh để đăng" (mẫu Mời cả nhà góp / Cảm ơn cả nhà) — tự lấy link mời góp chung của mình
 * (dùng lại link cũ còn hạn, chưa có thì tạo). Dùng cho ô Thao tác nhanh và ngăn kéo Chia sẻ, để không phải
 * đi qua trang Đóng góp → Mời người thân góp → Tạo link.
 */
export function InviteImageButton({
  clanId,
  clanName,
  trigger,
}: {
  clanId: string;
  clanName: string;
  trigger: (open: () => void, busy: boolean) => ReactNode;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => getOrCreateGeneralInviteUrl(clanId),
    onSuccess: (u) => {
      setUrl(u);
      void qc.invalidateQueries({ queryKey: ["contribute-links", clanId] });
    },
    onError: (e) =>
      toast.error(t`Không tạo được link mời góp`, {
        description: (e as Error).message,
      }),
  });
  return (
    <>
      {trigger(() => m.mutate(), m.isPending)}
      {url && (
        <InviteCardDialog
          open
          onClose={() => setUrl(null)}
          clanId={clanId}
          clanName={clanName}
          url={url}
          variants={["chung", "camon"]}
        />
      )}
    </>
  );
}
