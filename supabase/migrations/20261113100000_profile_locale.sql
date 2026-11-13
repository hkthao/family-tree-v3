-- Ngôn ngữ giao diện của từng người dùng: đồng bộ giữa các thiết bị, và để edge function
-- (email, push, bản tin tuần) biết gửi bằng ngôn ngữ nào. NULL = chưa chọn → dùng tiếng Việt.
-- Không đặt CHECK theo danh sách ngôn ngữ: thêm ngôn ngữ mới không phải đổi ràng buộc DB;
-- giá trị lạ được app bỏ qua và rơi về tiếng Việt.
alter table public.profiles
  add column if not exists locale text;

alter table public.profiles
  drop constraint if exists profiles_locale_len;
alter table public.profiles
  add constraint profiles_locale_len check (locale is null or char_length(locale) <= 10);
