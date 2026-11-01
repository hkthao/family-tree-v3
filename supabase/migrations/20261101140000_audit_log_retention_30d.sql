-- audit_log quá nặng (hàng chục nghìn dòng, ~1,2 GB cả bloat) mà ít dùng. Hai thay đổi:
-- 1) Chỉ giữ log 30 ngày (mặc định trước là 180, chạy mỗi Chủ nhật) → dọn mỗi ngày lúc 03:30.
-- 2) Không ghi log khi script (service_role) nhập / sửa dòng họ LỊCH SỬ (clans.kind='historical'):
--    mỗi lần nhập lại sẽ sinh hàng trăm dòng log chứa nguyên bản ghi (tiểu sử dài).
-- Chỉ ảnh hưởng nhật ký; người dùng sửa qua app (JWT authenticated) vẫn được ghi như cũ.
create or replace function public.prune_audit_log(retention_days integer default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
  declare
    effective_days int;
    deleted_count  int;
  begin
    effective_days := coalesce(
      retention_days,
      nullif(current_setting('app.audit_retention_days', true), '')::int,
      30
    );
    if effective_days < 7 then
      raise exception 'retention_days must be >= 7 (got %)', effective_days
        using errcode = '22023';
    end if;

    delete from public.audit_log
     where changed_at < now() - make_interval(days => effective_days);
    get diagnostics deleted_count = row_count;
    return deleted_count;
  end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobid = 2 and command like '%prune_audit_log%') then
    perform cron.alter_job(2, schedule := '30 3 * * *');
  end if;
end $$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
  declare
    e_type text;
    is_soft_delete boolean := false;
    v_clan uuid := case TG_OP when 'DELETE' then OLD.clan_id else NEW.clan_id end;
  begin
    -- Script (service_role) nhập dòng họ lịch sử: không ghi log.
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') = 'service_role'
       and exists (select 1 from public.clans where id = v_clan and kind = 'historical')
    then
      return case TG_OP when 'DELETE' then OLD else NEW end;
    end if;

    e_type := case TG_TABLE_NAME
      when 'persons'  then 'person'
      when 'families' then 'family'
      when 'branches' then 'branch'
    end;

    if TG_OP = 'INSERT' then
      insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
      values (NEW.clan_id, e_type, NEW.id, 'insert', null, to_jsonb(NEW), auth.uid());
      return NEW;

    elsif TG_OP = 'UPDATE' then
      is_soft_delete :=
        OLD.deleted_at is null and NEW.deleted_at is not null;

      if is_soft_delete then
        insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
        values (OLD.clan_id, e_type, OLD.id, 'delete', to_jsonb(OLD), null, auth.uid());
      else
        -- Bỏ qua nếu chỉ các cột phái sinh đổi (generation tính lại,
        -- unaccent/search tự cập nhật) — không phải sửa nội dung thật.
        if (to_jsonb(OLD) - 'generation' - 'full_name_unaccent' - 'search_text')
           = (to_jsonb(NEW) - 'generation' - 'full_name_unaccent' - 'search_text')
        then
          return NEW;
        end if;
        insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
        values (NEW.clan_id, e_type, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
      end if;
      return NEW;

    elsif TG_OP = 'DELETE' then
      insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
      values (OLD.clan_id, e_type, OLD.id, 'delete', to_jsonb(OLD), null, auth.uid());
      return OLD;
    end if;
    return null;
  end;
$$;
