import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { IconCopy, IconLink, IconShare2, IconUser } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import {
  CONTRIBUTE_LINK_TTL_DAYS,
  contributeLinkUrl,
  createContributeLink,
  type ContributeLink,
} from "@/lib/queries/community";

import { t } from "@lingui/core/macro";

/** Tin nhắn soạn sẵn kiểu nhắn nhóm gia đình (plan §4.3) — người gửi sửa tự do trước khi gửi. */
function draftMessage(opts: { clanName: string; personName?: string | null; recipient?: string | null; url: string }) {
  const hi = opts.recipient ? `${opts.recipient} ơi` : t`Cả nhà ơi`;
  const about = opts.personName
    ? t`con đang góp chuyện về ${opts.personName} vào gia phả họ ${opts.clanName}`
    : t`con đang góp chuyện, ảnh cũ vào gia phả họ ${opts.clanName}`;
  return t`${hi}, ${about}. Ai nhớ chút gì (một kỷ niệm, tấm ảnh cũ, hay ghi âm vài câu) thì bấm link này đóng góp giúp con nha, không cần đăng ký đâu ạ 🙏\n${opts.url}`;
}

/**
 * Ngăn kéo "Mời người thân góp": tạo link mời góp (mọi thành viên tạo được, tối đa 20 / ngày),
 * gắn tên người nhận + (tuỳ chọn) người được kể, rồi sao chép / chia sẻ kèm tin nhắn soạn sẵn.
 * Ảnh infographic mời góp làm ở P0c.
 */
export function ContributeLinkPanel({
  open,
  onClose,
  clanId,
  clanName,
  personId,
  personName,
}: {
  open: boolean;
  onClose: () => void;
  clanId: string;
  clanName: string;
  personId?: string | null;
  personName?: string | null;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [link, setLink] = useState<ContributeLink | null>(null);
  const [message, setMessage] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createContributeLink({ clan_id: clanId, recipient_label: recipient, root_person_id: personId ?? null }),
    onSuccess: (l) => {
      setLink(l);
      setMessage(
        draftMessage({ clanName, personName, recipient: l.recipient_label, url: contributeLinkUrl(l.token, personId) }),
      );
      track("community_link_create", { person: personId ? 1 : 0 });
      void qc.invalidateQueries({ queryKey: ["contribute-links", clanId] });
    },
    onError: (e) => toast.error(t`Chưa tạo được link`, { description: (e as Error).message }),
  });

  const url = link ? contributeLinkUrl(link.token, personId) : "";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t`Đã sao chép`);
    } catch {
      toast.error(t`Không sao chép được, hãy chọn và sao chép bằng tay`);
    }
  }

  async function share() {
    track("community_link_share");
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        /* người dùng huỷ */
      }
    }
    await copy(message);
  }

  function close() {
    setLink(null);
    setRecipient("");
    setMessage("");
    onClose();
  }

  return (
    <SidePanel
      open={open}
      onClose={close}
      title={t`Mời người thân đóng góp`}
      subtitle={personName ? t`Về ${personName}` : clanName}
    >
      {!link ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            {t`Tạo một link riêng gửi qua Zalo / Facebook. Người nhận bấm vào là đóng góp được ngay, không cần tài khoản. Link dùng được ${CONTRIBUTE_LINK_TTL_DAYS} ngày, bạn thu hồi được bất cứ lúc nào.`}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-recipient">{t`Gửi cho ai? (không bắt buộc)`}</Label>
            <Input
              id="contrib-recipient"
              icon={<IconUser />}
              value={recipient}
              maxLength={80}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t`Bác Ba, cô Hoa, nhóm Zalo họ…`}
            />
          </div>
          <FormActions>
            <Button type="button" variant="outline" onClick={close}>
              {t`Huỷ`}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              <IconLink className="mr-1.5 h-4 w-4" />
              {create.isPending ? t`Đang tạo…` : t`Tạo link mời`}
            </Button>
          </FormActions>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contrib-url">{t`Link mời góp`}</Label>
            <Input id="contrib-url" icon={<IconLink />} readOnly value={url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-msg">{t`Tin nhắn soạn sẵn (sửa thoải mái)`}</Label>
            <Textarea id="contrib-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => void copy(url)}>
              <IconCopy className="mr-1.5 h-4 w-4" />
              {t`Chỉ sao chép link`}
            </Button>
            <Button type="button" onClick={() => void share()}>
              <IconShare2 className="mr-1.5 h-4 w-4" />
              {t`Gửi tin nhắn`}
            </Button>
          </FormActions>
        </div>
      )}
    </SidePanel>
  );
}
