-- Phản hồi của quản trị gửi lại cho người đã góp ý (khác `admin_note` là ghi chú
-- NỘI BỘ, không được hiện cho người gửi). Người gửi xem lại các góp ý trước đây
-- và phản hồi/trạng thái xử lý ở ngăn kéo "Góp ý" → "Đã gửi".
alter table public.feedback
  add column if not exists admin_reply text,
  add column if not exists replied_at  timestamptz;

alter table public.feedback
  add constraint feedback_admin_reply_len
    check (admin_reply is null or char_length(admin_reply) <= 2000);
