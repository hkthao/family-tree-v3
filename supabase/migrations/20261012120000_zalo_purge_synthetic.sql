-- ============================================================================
-- Dọn tài khoản Zalo TẠM còn sót.
--
-- Mở Mini App lần đầu, người dùng nhận một tài khoản tạm mang email giả
-- `zalo-<id>@zalo.giapha.thaohk.com`. Khi họ liên kết với tài khoản email sẵn
-- có, ID Zalo được trỏ sang tài khoản kia và tài khoản tạm bị bỏ lại — không
-- ai đăng nhập vào được nữa, nhưng nó vẫn giữ tên/ảnh Zalo. Người dùng xoá
-- tài khoản thật xong thì thứ đó vẫn nằm trên máy chủ: "xoá" mà chưa sạch.
--
-- Hàm này trả về id của tài khoản tạm ĐƯỢC PHÉP XOÁ ứng với một ID Zalo:
--   • đúng là tài khoản do zalo-auth tạo (khớp cả email giả lẫn dấu
--     app_metadata.zalo_user_id — dấu này chỉ service role đặt được);
--   • không phải tài khoản đang được giữ lại (`p_keep`);
--   • không sở hữu dòng họ nào và không là thành viên dòng họ nào — có dữ
--     liệu đứng tên thì KHÔNG xoá, vì xoá tài khoản là mất theo.
-- Việc xoá thật do edge function làm qua admin API; hàm này chỉ trả lời
-- "có xoá được không". Chỉ service role gọi được.
-- ============================================================================

create function public.zalo_purgeable_synthetic_user(p_zalo_id text, p_keep uuid default null)
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
    and (p_keep is null or u.id <> p_keep)
    and not exists (select 1 from public.zalo_identities z where z.user_id = u.id)
    and not exists (select 1 from public.clans c where c.owner_id = u.id)
    and not exists (select 1 from public.clan_members m where m.user_id = u.id)
  limit 1
$$;

revoke all on function public.zalo_purgeable_synthetic_user(text, uuid) from public, anon, authenticated;
grant execute on function public.zalo_purgeable_synthetic_user(text, uuid) to service_role;
