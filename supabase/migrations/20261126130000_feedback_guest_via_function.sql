-- Phản hồi của KHÁCH chưa đăng nhập đi qua edge function `feedback-submit` (captcha + bẫy bot + trần tốc độ) thay vì INSERT thẳng bằng
-- quyền anon (docs/plan-recaptcha-public.md, bước 5). Thu hồi quyền INSERT của anon; người đã đăng nhập vẫn ghi trực tiếp với user_id
-- của chính mình (không bị hỏi captcha ở biểu mẫu thành viên).
--
-- THỨ TỰ KHI DEPLOY: phải deploy function `feedback-submit` + bản web mới TRƯỚC khi áp migration này, nếu không bản web cũ của khách
-- sẽ không gửi được phản hồi.

alter table public.feedback add column if not exists submitter_ip_hash text;
comment on column public.feedback.submitter_ip_hash is 'Băm SHA-256 của IP khách (do feedback-submit ghi) — chỉ để giới hạn tốc độ, không lưu IP thô.';
create index if not exists feedback_ip_hash_idx on public.feedback (submitter_ip_hash, created_at desc) where submitter_ip_hash is not null;

drop policy if exists feedback_insert_anyone on public.feedback;
drop policy if exists feedback_insert_authenticated on public.feedback;
create policy feedback_insert_authenticated
  on public.feedback for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke insert on public.feedback from anon;
