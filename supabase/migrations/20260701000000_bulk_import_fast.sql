-- ============================================================================
-- Import gia phả lớn không còn timeout.
--
-- Vấn đề: mỗi INSERT persons kích hoạt các trigger THEO DÒNG nặng —
-- đặc biệt trg_recompute_generation() tính lại đời cho TOÀN dòng họ mỗi
-- dòng → O(n²), 800+ người là vượt statement_timeout (8s).
--
-- Cách sửa: đặt cờ transaction-local `app.bulk_import`='on' trong RPC;
-- các trigger nặng (recompute đời, max_persons, person_count) tự bỏ qua khi
-- có cờ. RPC làm phần đắt MỘT LẦN ở cuối (finalize): tính lại đời +
-- cập nhật person_count. Thêm hỗ trợ nhập theo BATCH (nhiều lần gọi):
-- families dùng upsert để lần cuối điền vợ/chồng sau khi persons đã có.
-- ============================================================================

-- 1. Trigger recompute đời — bỏ qua khi đang bulk import.
create or replace function public.trg_recompute_generation()
  returns trigger
  language plpgsql
  as $$
  begin
    if current_setting('app.bulk_import', true) = 'on' then
      return case when TG_OP = 'DELETE' then OLD else NEW end;
    end if;
    if TG_OP = 'DELETE' then
      perform public.recompute_generation_for_clan(OLD.clan_id);
      return OLD;
    else
      perform public.recompute_generation_for_clan(NEW.clan_id);
      return NEW;
    end if;
  end;
  $$;

-- 2. enforce_max_persons — bỏ qua khi bulk (RPC đã kiểm tra cộng dồn 1 lần).
create or replace function public.enforce_max_persons()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    current_count int;
    clan_limit int;
  begin
    if current_setting('app.bulk_import', true) = 'on' then
      return new;
    end if;
    perform pg_advisory_xact_lock(
      hashtext('max_persons:' || new.clan_id::text)::bigint
    );
    select count(*) into current_count
    from public.persons
    where clan_id = new.clan_id and deleted_at is null;
    select max_persons into clan_limit
    from public.clans where id = new.clan_id;
    if current_count >= coalesce(clan_limit, 500) then
      raise exception 'Clan has reached max_persons limit (%)', clan_limit
        using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

-- 3. bump_person_count — bỏ qua khi bulk (RPC set lại person_count ở finalize).
create or replace function public.bump_person_count()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if current_setting('app.bulk_import', true) = 'on' then
      return null;
    end if;
    if TG_OP = 'INSERT' then
      if new.deleted_at is null then
        update public.clans set person_count = person_count + 1 where id = new.clan_id;
      end if;
    elsif TG_OP = 'DELETE' then
      if old.deleted_at is null then
        update public.clans set person_count = greatest(person_count - 1, 0) where id = old.clan_id;
      end if;
    elsif TG_OP = 'UPDATE' then
      if old.deleted_at is null and new.deleted_at is not null then
        update public.clans set person_count = greatest(person_count - 1, 0) where id = new.clan_id;
      elsif old.deleted_at is not null and new.deleted_at is null then
        update public.clans set person_count = person_count + 1 where id = new.clan_id;
      end if;
    end if;
    return null;
  end;
  $$;

-- 4. RPC nhập hàng loạt — cờ bulk + hỗ trợ batch + finalize.
-- Bỏ bản 2-tham-số cũ (chậm) để mọi lời gọi đi vào bản mới.
drop function if exists public.bulk_import_persons(uuid, jsonb);

create or replace function public.bulk_import_persons(
  target_clan uuid,
  payload jsonb,
  p_finalize boolean default true
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    caller uuid := auth.uid();
    persons_arr jsonb := coalesce(payload->'persons', '[]'::jsonb);
    families_arr jsonb := coalesce(payload->'families', '[]'::jsonb);
    branches_arr jsonb := coalesce(payload->'branches', '[]'::jsonb);
    persons_to_add int := jsonb_array_length(persons_arr);
    current_count int;
    clan_limit int;
  begin
    if caller is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if not public.can_edit_clan(target_clan) then
      raise exception 'Not allowed to edit this clan' using errcode = '42501';
    end if;

    -- Bỏ qua các trigger nặng theo dòng trong suốt call này.
    perform set_config('app.bulk_import', 'on', true);

    -- Giới hạn max_persons (cộng dồn, đúng cả khi nhập nhiều batch).
    perform pg_advisory_xact_lock(
      hashtext('max_persons:' || target_clan::text)::bigint
    );
    select count(*) into current_count
    from public.persons where clan_id = target_clan and deleted_at is null;
    select max_persons into clan_limit from public.clans where id = target_clan;
    if current_count + persons_to_add > coalesce(clan_limit, 500) then
      raise exception
        'Import would exceed max_persons (% existing + % new > %)',
        current_count, persons_to_add, clan_limit
        using errcode = 'check_violation';
    end if;

    set constraints all deferred;

    insert into public.branches(id, clan_id, name)
    select (b->>'id')::uuid, target_clan, b->>'name'
    from jsonb_array_elements(branches_arr) as b
    on conflict (id) do nothing;

    -- Families: upsert — batch cuối gửi lại kèm vợ/chồng để điền sau khi
    -- persons đã có (batch đầu có thể để husband/wife null).
    insert into public.families(id, clan_id, husband_id, wife_id, union_type)
    select
      (f->>'id')::uuid, target_clan,
      nullif(f->>'husband_id', '')::uuid,
      nullif(f->>'wife_id', '')::uuid,
      coalesce(f->>'union_type', 'marriage')
    from jsonb_array_elements(families_arr) as f
    on conflict (id) do update
      set husband_id = excluded.husband_id,
          wife_id = excluded.wife_id;

    insert into public.persons(
      id, clan_id, full_name, gender, is_living, is_root,
      birth_date, birth_date_precision, death_date, death_date_precision,
      branch_id, birth_family_id, bio
    )
    select
      (p->>'id')::uuid, target_clan, p->>'full_name', p->>'gender',
      coalesce((p->>'is_living')::boolean, true),
      coalesce((p->>'is_root')::boolean, false),
      nullif(p->>'birth_date', '')::date, nullif(p->>'birth_date_precision', ''),
      nullif(p->>'death_date', '')::date, nullif(p->>'death_date_precision', ''),
      nullif(p->>'branch_id', '')::uuid, nullif(p->>'birth_family_id', '')::uuid,
      nullif(p->>'bio', '')
    from jsonb_array_elements(persons_arr) as p
    on conflict (id) do nothing;

    -- Phần đắt: chỉ chạy MỘT LẦN ở batch cuối.
    if p_finalize then
      update public.clans
        set person_count = (
          select count(*) from public.persons
          where clan_id = target_clan and deleted_at is null
        )
      where id = target_clan;
      perform public.recompute_generation_for_clan(target_clan);
    end if;

    return jsonb_build_object(
      'imported_branches', jsonb_array_length(branches_arr),
      'imported_families', jsonb_array_length(families_arr),
      'imported_persons', persons_to_add
    );
  end;
  $$;

revoke execute on function public.bulk_import_persons(uuid, jsonb, boolean) from public;
grant execute on function public.bulk_import_persons(uuid, jsonb, boolean) to authenticated;
