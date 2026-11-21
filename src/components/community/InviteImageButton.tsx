import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { useToast } from "@/components/Toast";
import { InviteCardDialog } from "@/components/community/InviteCardDialog";
import { supabase } from "@/lib/supabase";
import {
  contributeLinkUrl,
  createContributeLink,
  listContributeLinks,
} from "@/lib/queries/community";

import { t } from "@lingui/core/macro";

/** Link mời góp chung (không gắn người, không ghi tên người nhận) của chính mình còn dùng được — dùng lại, khỏi tốn hạn mức. */
async function getOrCreateGeneralInviteUrl(clanId: string): Promise<string> {
  const [{ data: auth }, links] = await Promise.all([supabase.auth.getUser(), listContributeLinks(clanId)]);
  const me = auth.user?.id;
  const soon = Date.now() + 7 * 86_400_000; // còn hạn ít nhất 7 ngày để người nhận kịp mở
  const reuse = links.find(
    (l) =>
      l.created_by === me &&
      !l.root_person_id &&
      !l.recipient_label &&
      !l.is_revoked &&
      !l.contrib_paused_at &&
      new Date(l.expires_at).getTime() > soon,
  );
  const link = reuse ?? (await createContributeLink({ clan_id: clanId }));
  return contributeLinkUrl(link.token);
}

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
    onError: (e) => toast.error(t`Không tạo được link mời góp`, { description: (e as Error).message }),
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
