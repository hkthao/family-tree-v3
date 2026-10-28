-- ============================================================================
-- Liên kết Zalo với tài khoản SẴN CÓ (đăng ký bằng email trên web).
--
-- Người đã có tài khoản email mà mở Mini App sẽ thành tài khoản mới, không
-- thấy dòng họ của mình. Họ nhập email → nhận mã 6 số qua thư → nhập mã →
-- ID Zalo được trỏ sang tài khoản cũ. Bảng này giữ mã ĐÃ BĂM đang chờ.
--
-- RLS bật, KHÔNG policy: chỉ edge function `zalo-link` (service role) đụng
-- tới. Một ID Zalo chỉ có một mã chờ (khoá chính) — xin mã mới là đè mã cũ.
-- ============================================================================

create table public.zalo_link_codes (
  zalo_user_id text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  code_hash    text not null,
  attempts     int  not null default 0,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table public.zalo_link_codes enable row level security;

-- Tra tài khoản theo email. PostgREST không mở schema auth, và admin API
-- của GoTrue không có "tìm theo email" — nên cần một hàm, khoá chặt cho
-- service role. Bỏ qua tài khoản mang địa chỉ giả của Zalo: liên kết Zalo
-- vào một tài khoản Zalo khác là vô nghĩa.
create function public.zalo_find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
    and u.email not like 'zalo-%@zalo.giapha.thaohk.com'
  limit 1
$$;

revoke all on function public.zalo_find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.zalo_find_user_id_by_email(text) to service_role;
