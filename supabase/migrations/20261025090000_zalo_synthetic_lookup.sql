-- ============================================================================
-- zalo_synthetic_user_id — tài khoản Zalo tạm (email giả) của một ID Zalo.
--
-- Dùng cho webhook `zalo-webhook` khi người dùng rút lại sự đồng ý: tài khoản
-- tạm còn đứng tên dữ liệu thì không xoá được, nhưng phải gỡ tên/ảnh lấy từ
-- Zalo. `zalo_find_user_id_by_email` cố ý bỏ qua email giả (luồng liên kết
-- không được trỏ vào tài khoản tạm) nên không dùng lại được.
--
-- Khớp cả email lẫn dấu app_metadata do zalo-auth đặt — như
-- zalo_purgeable_synthetic_user. Chỉ service role gọi được.
-- ============================================================================

create function public.zalo_synthetic_user_id(p_zalo_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where u.email = 'zalo-' || p_zalo_id || '@zalo.giapha.thaohk.com'
    and u.raw_app_meta_data ->> 'zalo_user_id' = p_zalo_id
  limit 1
$$;

revoke all on function public.zalo_synthetic_user_id(text) from public, anon, authenticated;
grant execute on function public.zalo_synthetic_user_id(text) to service_role;
