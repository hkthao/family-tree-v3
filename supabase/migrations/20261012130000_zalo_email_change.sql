-- ============================================================================
-- Đổi (hoặc thêm) email của tài khoản ngay trong Zalo Mini App.
--
-- Dùng lại bảng mã chờ của phần liên kết: gửi mã 6 số tới email MỚI, đúng mã
-- mới đổi. Khác phần liên kết ở chỗ email mới chưa là tài khoản nào, nên:
--   • `user_id` được phép trống (mã đổi email không trỏ tới tài khoản đích);
--   • thêm cột `email` giữ địa chỉ đang chờ xác minh.
-- Vì sao phải có mã: máy chủ đang bật tự xác nhận email, đổi thẳng qua
-- auth.updateUser là nhận được bất kỳ địa chỉ nào mà không cần chứng minh
-- mình đọc được hộp thư đó.
-- ============================================================================

alter table public.zalo_link_codes alter column user_id drop not null;
alter table public.zalo_link_codes add column email text;

comment on column public.zalo_link_codes.email is
  'Email mới đang chờ xác minh (luồng đổi email). Null ở luồng liên kết.';
