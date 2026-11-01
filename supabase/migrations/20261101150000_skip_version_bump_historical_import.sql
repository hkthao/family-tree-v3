-- Script nhập dòng họ lịch sử (service_role) ghi hàng trăm câu lệnh; mỗi câu lệnh tăng clans.data_version và
-- Realtime phát cho mọi máy đang xem dòng họ đó → máy khách tải lại cả cây liên tục (hàng chục request/giây).
-- Bỏ qua việc tăng version cho dòng họ lịch sử khi người gọi là service_role; script tự tăng MỘT lần ở cuối.
-- Người dùng sửa qua app (authenticated) vẫn tăng như cũ.
create or replace function public.bump_data_version()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
  declare
    v_service boolean := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') = 'service_role';
  begin
    if TG_OP = 'DELETE' then
      update public.clans c
      set data_version = c.data_version + 1
      where c.id in (select distinct clan_id from old_rows)
        and not (v_service and c.kind = 'historical');
    elsif TG_OP = 'INSERT' then
      update public.clans c
      set data_version = c.data_version + 1
      where c.id in (select distinct clan_id from new_rows)
        and not (v_service and c.kind = 'historical');
    else  -- UPDATE
      update public.clans c
      set data_version = c.data_version + 1
      where c.id in (
        select distinct clan_id from new_rows
        union
        select distinct clan_id from old_rows
      )
        and not (v_service and c.kind = 'historical');
    end if;
    return null;
  end;
$$;
