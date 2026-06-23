-- Tối ưu tiếp recompute_generation_for_clan.
--
-- Bản trước (BFS lặp) vẫn chậm với họ lớn vì join cha/mẹ dùng OR:
--   join persons parent on (parent.id = f.husband_id or parent.id = f.wife_id)
-- OR khiến planner không dùng index → quét O(family × person) mỗi vòng.
-- Với cây thật ~4800 người / 9 đời, recompute mất ~47s (và vì recompute
-- chạy trong trigger mỗi lần sửa người, họ lớn sẽ rất chậm cả khi nhập
-- tay, không riêng import).
--
-- Bản này tách OR thành UNION ALL hai join theo index (husband_id /
-- wife_id), nên mỗi vòng dùng index PK + index FK. Kết quả không đổi.

create or replace function public.recompute_generation_for_clan(target_clan uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    n_blood int;
    n_spouse int;
    loop_guard int := 0;
  begin
    update public.persons
    set generation = case when is_root then 1 else null end
    where clan_id = target_clan;

    loop
      loop_guard := loop_guard + 1;
      exit when loop_guard > 80;

      -- Đời cha/mẹ đã biết cho từng family — hai join theo index, gộp
      -- bằng UNION ALL (tránh OR-join quét toàn bảng).
      with parent_gen as (
        select f.id as fid, ph.generation as gen
        from public.families f
        join public.persons ph
          on ph.id = f.husband_id
          and ph.clan_id = target_clan
          and ph.deleted_at is null
          and ph.generation is not null
        where f.clan_id = target_clan and f.deleted_at is null
        union all
        select f.id as fid, pw.generation as gen
        from public.families f
        join public.persons pw
          on pw.id = f.wife_id
          and pw.clan_id = target_clan
          and pw.deleted_at is null
          and pw.generation is not null
        where f.clan_id = target_clan and f.deleted_at is null
      ),
      cand as (
        select child.id as person_id, min(pg.gen) + 1 as gen
        from public.persons child
        join parent_gen pg on child.birth_family_id = pg.fid
        where child.clan_id = target_clan
          and child.deleted_at is null
          and not child.is_root
          and child.generation is null
        group by child.id
      )
      update public.persons p
      set generation = cand.gen
      from cand
      where p.id = cand.person_id;
      get diagnostics n_blood = row_count;

      -- Lan đời sang vợ/chồng (join theo id, không cần đổi).
      with src as (
        select
          case when ph.generation is null then ph.id else pw.id end as person_id,
          coalesce(ph.generation, pw.generation) as gen
        from public.families f
        join public.persons ph
          on ph.id = f.husband_id
          and ph.clan_id = target_clan
          and ph.deleted_at is null
        join public.persons pw
          on pw.id = f.wife_id
          and pw.clan_id = target_clan
          and pw.deleted_at is null
        where f.clan_id = target_clan
          and f.deleted_at is null
          and (ph.generation is null) <> (pw.generation is null)
      )
      update public.persons p
      set generation = src.gen
      from src
      where p.id = src.person_id
        and p.generation is null;
      get diagnostics n_spouse = row_count;

      exit when n_blood = 0 and n_spouse = 0;
    end loop;
  end;
  $$;
