-- ============================================================================
-- Đưa nội dung email vào CHUÔNG THÔNG BÁO trong app.
--
-- Vấn đề: mọi thứ hệ thống gửi đi (nhắc giỗ, đóng góp mới, thông gia,
-- bản tin tuần) chỉ nằm trong hộp thư email. Ai không mở mail — hoặc
-- mail rơi vào thư rác, chuyện thường với domain nhỏ — thì không bao giờ
-- biết. Còn cái chuông trong app thì chỉ có thông báo do admin viết tay.
--
-- Cách làm: tái dùng `notification_log` — bảng vốn đã ghi "đã gửi gì cho
-- ai" và đã có RLS chỉ-chính-chủ-đọc. Chỉ thiếu phần NGƯỜI ĐỌC ĐƯỢC:
-- tiêu đề, một dòng tóm tắt, đường dẫn để bấm vào, và dấu đã đọc.
--
-- Không đẩy vào bảng `announcements`: bảng đó là thông báo TOÀN NỀN TẢNG
-- do admin viết, mọi người thấy chung. Nhét thông báo riêng của từng
-- người vào đó là lộ chuyện nhà người khác.
-- ============================================================================

-- ─── Sửa một lỗi im lặng phát hiện khi làm việc này ──────────────────
-- Ràng buộc `channel` chỉ cho 'email' và 'sms', trong khi
-- notify-contribution và weekly-digest vẫn ghi channel='webpush' để
-- chống gửi trùng. Mọi lượt ghi đó BỊ TỪ CHỐI, và code nuốt lỗi — nên
-- phần chống gửi trùng của web push chưa từng hoạt động: chạy lại
-- function là người dùng bị đẩy thông báo lần nữa.
--
-- Bằng chứng trên production (30/08/2026): bảng chỉ có 40 dòng 'email',
-- KHÔNG có dòng 'webpush' nào.
alter table public.notification_log
  drop constraint if exists notification_log_channel_check;
alter table public.notification_log
  add constraint notification_log_channel_check
  check (channel in ('email', 'sms', 'webpush', 'inapp'));

alter table public.notification_log
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists url text,
  add column if not exists read_at timestamptz;

comment on column public.notification_log.title is
  'Tiêu đề hiện trong chuông. NULL = bản ghi cũ, chỉ để đối soát gửi mail.';
comment on column public.notification_log.url is
  'Đường dẫn trong app khi bấm vào. Đường dẫn tương đối, không phải link ngoài.';

-- Chuông đọc theo thứ tự thời gian và chỉ lấy dòng CÓ nội dung.
create index if not exists notification_log_inbox_idx
  on public.notification_log (user_id, sent_at desc)
  where title is not null;

-- ─── Đánh dấu đã đọc ──────────────────────────────────────────────────
-- Người dùng chỉ được sửa ĐÚNG dòng của mình, và thực tế chỉ sửa read_at
-- (những cột khác không có đường nào để đổi từ client vì policy này chỉ
-- áp cho chính chủ, còn nội dung thì do service role ghi).
drop policy if exists notification_log_self_update on public.notification_log;
create policy notification_log_self_update on public.notification_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, update on public.notification_log to authenticated;

/*
 * Đánh dấu đã đọc TẤT CẢ — một câu, không phải N lần gọi từ client.
 *
 * Người dùng bấm "đánh dấu tất cả" khi có ba chục thông báo; ba chục
 * lượt gọi mạng trên 3G là chờ mòn mỏi rồi bỏ giữa chừng.
 */
create or replace function public.notifications_mark_all_read()
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'notifications_mark_all_read: chưa đăng nhập';
  end if;

  update public.notification_log
     set read_at = now()
   where user_id = v_uid and read_at is null and title is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notifications_mark_all_read() from public, anon;
grant execute on function public.notifications_mark_all_read() to authenticated;
