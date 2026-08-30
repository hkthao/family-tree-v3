import { supabase } from "../supabase";

/**
 * Hộp thư trong app — những gì hệ thống đã gửi cho CHÍNH BẠN.
 *
 * Khác `announcements`: bảng đó là thông báo toàn nền tảng do admin
 * viết, ai cũng thấy như nhau. Còn đây là việc của riêng từng người —
 * nhắc giỗ của dòng họ họ, đóng góp chờ duyệt, thông gia. Trộn hai thứ
 * vào một bảng là lộ chuyện nhà người khác.
 *
 * Nguồn là `notification_log`, bảng vốn đã ghi "đã gửi gì cho ai" để
 * chống gửi trùng. Nhờ đọc chính bản ghi đó mà không có cảnh mail đã đi
 * mà chuông vẫn im.
 */

export interface InboxItem {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  sent_at: string;
  read_at: string | null;
  /** 'email' | 'inapp' | 'webpush' — chỉ để chẩn đoán, không hiện ra. */
  channel: string;
}

/** Chỉ lấy dòng CÓ tiêu đề: dòng cũ trước tính năng này chỉ để đối soát. */
export async function listMyInbox(limit = 20): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("notification_log")
    .select("id, title, body, url, sent_at, read_at, channel")
    .not("title", "is", null)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxItem[];
}

export async function inboxUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .not("title", "is", null)
    .is("read_at", null);
  if (error) return 0; // chưa áp migration → coi như không có gì
  return count ?? 0;
}

export async function markInboxRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notification_log")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/** Một câu SQL thay vì N lượt gọi — xem migration để biết vì sao. */
export async function markAllInboxRead(): Promise<number> {
  const { data, error } = await supabase.rpc("notifications_mark_all_read");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
