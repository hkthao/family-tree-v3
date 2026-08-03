-- Cờ opt-in cho "Bản tin tuần" (weekly-digest edge function).
-- Mặc định BẬT cho mọi người (có link tắt trong Tài khoản). Digest gộp
-- 1 tin/tuần nên không spam; ai không muốn tự tắt.
alter table public.profiles
  add column if not exists notify_weekly_digest boolean not null default true;
