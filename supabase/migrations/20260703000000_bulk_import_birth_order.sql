-- bulk_import_persons: ghi thêm birth_order ("con thứ mấy") khi nhập Excel.
--
-- Excel giờ có cột "Thứ tự con" → importPersons.ts đưa birth_order vào
-- payload. RPC cũ (20260701000000) chưa chèn cột này nên thứ tự con bị
-- mất → sơ đồ/danh bạ xếp anh-chị-em theo năm sinh/tên (sai). Re-emit
-- hàm với birth_order trong INSERT. Chỉ đổi phần insert persons.

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

    perform set_config('app.bulk_import', 'on', true);

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
      branch_id, birth_family_id, birth_order, bio
    )
    select
      (p->>'id')::uuid, target_clan, p->>'full_name', p->>'gender',
      coalesce((p->>'is_living')::boolean, true),
      coalesce((p->>'is_root')::boolean, false),
      nullif(p->>'birth_date', '')::date, nullif(p->>'birth_date_precision', ''),
      nullif(p->>'death_date', '')::date, nullif(p->>'death_date_precision', ''),
      nullif(p->>'branch_id', '')::uuid, nullif(p->>'birth_family_id', '')::uuid,
      nullif(p->>'birth_order', '')::int,
      nullif(p->>'bio', '')
    from jsonb_array_elements(persons_arr) as p
    on conflict (id) do nothing;

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
