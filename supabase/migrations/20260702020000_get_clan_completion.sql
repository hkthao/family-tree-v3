-- Gộp phép tính "Họ ta đã hoàn thành X%" vào MỘT RPC security-definer.
--
-- Vấn đề: getClanCompletion trước đây chạy 2 truy vấn song song:
--   1. count(*) persons qua PostgREST (HEAD ?count=exact) — DÍNH RLS.
--   2. count_clan_completion_gaps() — RPC security-definer, KHÔNG dính RLS.
--
-- Truy vấn (1) time-out (57014) trên gia phả lớn vì policy persons_select
-- gọi is_clan_member(clan_id) với đối số là CỘT clan_id của từng dòng.
-- Vì đối số thay đổi theo dòng, Postgres KHÔNG cache được hàm STABLE này
-- mà gọi lại cho MỖI dòng → mỗi lần lại subquery clan_members + profiles.
-- Đếm vài nghìn người ⇒ hàng nghìn subquery ⇒ vượt statement_timeout.
--
-- Cách sửa: đếm bên trong hàm security-definer (bỏ qua RLS, kiểm tra
-- quyền MỘT lần), tính cả `total` và `with_gaps` trong CÙNG một lượt quét
-- index (persons_clan_alive_idx) — 1 round-trip thay vì 2.
--
-- Logic gaps giữ nguyên count_clan_completion_gaps. Không JOIN nên
-- count(*) filter (…) tương đương count(distinct id) filter (…).

create or replace function public.get_clan_completion(p_clan_id uuid)
  returns table (total bigint, with_gaps bigint)
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if not (
      coalesce(public.is_clan_member(p_clan_id), false)
      or public.is_platform_admin()
    ) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;

    return query
    select
      count(*)::bigint,
      count(*) filter (
        where
          (p.is_root = false and p.birth_family_id is null)
          or (p.birth_date is null and p.birth_lunar_year is null)
          or (
            p.is_living = false
            and p.death_date is null
            and p.death_lunar_year is null
            and p.death_anniv_lunar_month is null
          )
      )::bigint
    from public.persons p
    where p.clan_id = p_clan_id
      and p.deleted_at is null
      and p.todo_excluded = false;
  end;
  $$;

revoke all on function public.get_clan_completion(uuid)
  from public, anon;
grant execute on function public.get_clan_completion(uuid)
  to authenticated;
