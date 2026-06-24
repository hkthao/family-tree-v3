-- Chặn audit_log phình vô ích.
--
-- write_audit_log ghi 1 dòng audit (kèm cả JSON before + after) cho MỌI
-- update trên persons/families/branches. Nhưng recompute_generation
-- chạy cập nhật cột `generation` cho hàng nghìn người mỗi lần cây thay
-- đổi — và các cột phái sinh `full_name_unaccent` / `search_text` cũng
-- được trigger tự cập nhật. Những thay đổi này KHÔNG phải do người dùng
-- chỉnh sửa nội dung, nhưng vẫn bị ghi audit → ~74% audit_log là rác,
-- bảng phình tới hàng GB.
--
-- Sửa: bỏ qua audit cho UPDATE khi CHỈ các cột phái sinh đổi (so sánh
-- before/after sau khi loại các cột này). Sửa nội dung thật (tên, ngày,
-- tiểu sử…) vẫn được audit như cũ. INSERT / xoá / xoá-mềm giữ nguyên.

create or replace function public.write_audit_log()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    e_type text;
    is_soft_delete boolean := false;
  begin
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
