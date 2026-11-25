import { supabase } from "@/lib/supabase";
import { contributeLinkUrl, createContributeLink, listContributeLinks } from "@/lib/queries/community";

/** Link mời góp chung (không gắn người, không ghi tên người nhận) của chính mình còn dùng được — dùng lại, khỏi tốn hạn mức; chưa có thì tạo. */
export async function getOrCreateGeneralInviteUrl(clanId: string): Promise<string> {
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
