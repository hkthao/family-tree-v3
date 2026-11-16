-- Sửa lỗi sau khi gỡ trợ lý AI (20261115200000): trigger `protect_clan_privileged_cols` vẫn đọc new.ai_daily_limit /
-- new.ai_monthly_limit — hai cột đã bị xoá — nên MỌI lệnh UPDATE bảng `clans` của người không phải admin hệ thống đều lỗi
-- `record "new" has no field "ai_daily_limit"` (vd Nhập từ Excel cập nhật số người của dòng họ). Giữ nguyên các chốt còn lại.
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
      raise exception 'Only platform admin can transfer clan ownership';
    end if;
  end if;
  return new;
end;
$function$;
