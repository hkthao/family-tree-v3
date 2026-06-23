-- Tối ưu recompute_generation_for_clan cho gia phả lớn.
--
-- Bản cũ dùng recursive CTE không khử trùng lặp: mỗi người con được
-- "đi tới" qua CẢ cha lẫn mẹ (join parent on husband OR wife) nên số
-- dòng trung gian nhân đôi mỗi đời (≈ 2^depth). Với ~200 người vài đời
-- thì ổn, nhưng họ lớn (vài nghìn người, hơn chục đời) thì bùng nổ tổ
-- hợp → chạy hàng phút → "canceling statement due to statement timeout"
-- khi import (vd job 4802 người).
--
-- Bản mới: BFS lặp theo từng đời bằng UPDATE set-based. Mỗi vòng gán
-- đời cho những người con CHƯA có đời mà cha/mẹ đã có đời, đồng thời
-- lan đời sang vợ/chồng. Lặp tới khi không còn ai được gán (cap 80
-- vòng phòng vòng lặp). Chi phí O(số_đời × số_family) thay vì luỹ thừa.

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
    -- Reset: thuỷ tổ = đời 1, còn lại null.
    update public.persons
    set generation = case when is_root then 1 else null end
    where clan_id = target_clan;

    loop
      loop_guard := loop_guard + 1;
      exit when loop_guard > 80;

      -- Huyết thống: con (chưa có đời) nhận min(đời cha/mẹ) + 1.
      -- Cha/mẹ ở đây gồm cả husband lẫn wife của birth_family, nên
      -- đời lan xuống dù chỉ một bên có đời.
      with cand as (
        select child.id as person_id, min(parent.generation) + 1 as gen
        from public.persons child
        join public.families f
          on child.birth_family_id = f.id
          and f.deleted_at is null
        join public.persons parent
          on (parent.id = f.husband_id or parent.id = f.wife_id)
          and parent.clan_id = target_clan
          and parent.deleted_at is null
          and parent.generation is not null
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

      -- Lan đời sang vợ/chồng: family đủ 2 partner, một bên có đời,
      -- bên kia null → copy sang.
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
