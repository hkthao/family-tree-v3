-- Sửa timeout khi import gia phả lớn: tắt audit trigger trong lúc import.
--
-- admin_import_giapha tắt 4 trigger tính generation rồi gọi recompute 1
-- lần. Nhưng recompute chạy nhiều câu UPDATE persons.generation, và
-- persons_audit_trg (AFTER UPDATE FOR EACH ROW) ghi audit_log cho TỪNG
-- dòng (to_jsonb OLD + NEW) → ~9600 lần ghi cho họ 4800 người → 65s →
-- "statement timeout". Đo thực: tắt audit_trg thì recompute 4800/9 đời
-- chỉ còn 134ms (so với 65s).
--
-- Import hàng loạt (admin) không cần audit từng dòng — đã có bản ghi
-- job import làm dấu vết. Nên tắt cả persons_audit_trg và
-- families_audit_trg trong suốt thao tác (giữ tắt tới SAU recompute),
-- rồi bật lại.

create or replace function public.admin_import_giapha(
  p_clan_id uuid,
  p_persons jsonb,
  p_families jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    n_persons int;
    n_families int;
  begin
    set local statement_timeout = 0;

    -- Tắt trigger tính generation (per-row, O(n²)) + audit (per-row,
    -- ghi log từng dòng — quá tốn khi recompute cập nhật hàng nghìn
    -- dòng generation).
    alter table public.persons disable trigger persons_recompute_generation_trg;
    alter table public.persons disable trigger persons_recompute_generation_update_trg;
    alter table public.families disable trigger families_recompute_generation_trg;
    alter table public.families disable trigger families_recompute_generation_update_trg;
    alter table public.persons disable trigger persons_audit_trg;
    alter table public.families disable trigger families_audit_trg;

    insert into public.families (id, clan_id, husband_id, wife_id, union_type, spouse_order)
    select (e->>'id')::uuid, p_clan_id, null, null, 'marriage',
           nullif(e->>'spouse_order', '')::int
    from jsonb_array_elements(p_families) e;

    insert into public.persons (
      id, clan_id, full_name, gender, is_living, is_root,
      birth_date, birth_date_precision, death_date, death_date_precision,
      birth_family_id, nickname, courtesy_name, birth_place, burial_place, bio,
      death_lunar_year, death_lunar_month, death_lunar_day, death_lunar_is_leap,
      death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap
    )
    select
      (e->>'id')::uuid, p_clan_id, e->>'full_name', e->>'gender',
      coalesce((e->>'is_living')::boolean, true),
      coalesce((e->>'is_root')::boolean, false),
      nullif(e->>'birth_date', '')::date, nullif(e->>'birth_date_precision', ''),
      nullif(e->>'death_date', '')::date, nullif(e->>'death_date_precision', ''),
      nullif(e->>'birth_family_id', '')::uuid,
      nullif(e->>'nickname', ''), nullif(e->>'courtesy_name', ''),
      nullif(e->>'birth_place', ''), nullif(e->>'burial_place', ''),
      nullif(e->>'bio', ''),
      nullif(e->>'death_lunar_year', '')::int, nullif(e->>'death_lunar_month', '')::int,
      nullif(e->>'death_lunar_day', '')::int,
      coalesce((e->>'death_lunar_is_leap')::boolean, false),
      nullif(e->>'death_anniv_lunar_month', '')::int,
      nullif(e->>'death_anniv_lunar_day', '')::int,
      coalesce((e->>'death_anniv_lunar_is_leap')::boolean, false)
    from jsonb_array_elements(p_persons) e;

    update public.families f
       set husband_id = nullif(e->>'husband_id', '')::uuid,
           wife_id = nullif(e->>'wife_id', '')::uuid
    from jsonb_array_elements(p_families) e
    where f.id = (e->>'id')::uuid;

    -- Clear pending deferred-FK events so ENABLE TRIGGER can run.
    set constraints all immediate;

    -- Cập nhật thống kê sau khi nạp hàng nghìn dòng — nếu không,
    -- planner dùng stats cũ (tưởng bảng ít dòng) → chọn plan tệ cho các
    -- join trong recompute → chậm hàng chục giây. ANALYZE xong recompute
    -- 4800 người chỉ còn ~0.2s.
    analyze public.persons;
    analyze public.families;

    -- Recompute MỘT lần khi MỌI trigger vẫn đang tắt. Quan trọng: phải
    -- chạy TRƯỚC khi bật lại các trigger generation — nếu bật trước,
    -- mỗi câu UPDATE generation bên trong recompute sẽ kích hoạt trigger
    -- persons_recompute_generation_update_trg → đệ quy tính lại cả clan
    -- cho từng dòng → O(n²), 4800 người mất ~66s. Tắt hết thì chỉ ~0.2s.
    perform public.recompute_generation_for_clan(p_clan_id);

    alter table public.persons enable trigger persons_recompute_generation_trg;
    alter table public.persons enable trigger persons_recompute_generation_update_trg;
    alter table public.families enable trigger families_recompute_generation_trg;
    alter table public.families enable trigger families_recompute_generation_update_trg;
    alter table public.persons enable trigger persons_audit_trg;
    alter table public.families enable trigger families_audit_trg;

    n_persons := jsonb_array_length(p_persons);
    n_families := jsonb_array_length(p_families);
    return jsonb_build_object('persons', n_persons, 'families', n_families);
  end;
  $$;

revoke all on function public.admin_import_giapha(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_giapha(uuid, jsonb, jsonb) to service_role;
