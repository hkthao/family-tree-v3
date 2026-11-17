-- Hai lỗi quyền do test bắt được:
--
-- 1. Xoá tài khoản (delete_my_account) của người làm chủ một dòng họ chưa có ai bị chặn với lỗi
--    "Only platform admin can transfer clan ownership". delete_my_account bật cờ giao dịch
--    `app.allow_owner_clear` để cho phép owner_id → NULL (20260530144551), nhưng các bản viết lại
--    trigger sau đó (memory_rooms, clan_ai_limits, 20261117400000) đã làm mất ngoại lệ này.
--    Khôi phục ngoại lệ, giữ nguyên các chốt còn lại.
--
-- 2. get_clan_stats: `revoke ... from public` không gỡ được quyền của `anon` vì Supabase cấp EXECUTE
--    thẳng cho anon qua default privileges. Hàm chỉ dành cho người đã đăng nhập → thu quyền anon.

create or replace function public.protect_clan_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_platform_admin() then
    if new.max_persons is distinct from old.max_persons then
      raise exception 'Only platform admin can change max_persons';
    end if;
    if new.max_users is distinct from old.max_users then
      raise exception 'Only platform admin can change max_users';
    end if;
    if new.max_memory_rooms is distinct from old.max_memory_rooms then
      raise exception 'Only platform admin can change max_memory_rooms';
    end if;
    if new.owner_id is distinct from old.owner_id then
      -- Chỉ cho xoá trống chủ sở hữu khi delete_my_account bật cờ (cờ tự hết khi giao dịch kết thúc).
      if not (new.owner_id is null and current_setting('app.allow_owner_clear', true) = 'true') then
        raise exception 'Only platform admin can transfer clan ownership';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

revoke execute on function public.get_clan_stats(uuid) from anon;
