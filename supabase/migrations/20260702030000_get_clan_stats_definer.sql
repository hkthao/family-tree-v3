-- get_clan_stats: bỏ timeout trên gia phả lớn.
--
-- Bản cũ là SECURITY INVOKER và chạy 6 truy vấn count(*)/max riêng lẻ
-- trên persons — MỖI truy vấn lại dính policy persons_select gọi
-- is_clan_member(clan_id) theo TỪNG dòng (đối số là cột clan_id nên
-- Postgres không cache được hàm STABLE). ~6 × N dòng × subquery ⇒ vượt
-- statement_timeout (57014) trên clan lớn — cùng nguyên nhân với
-- get_clan_completion.
--
-- Sửa: SECURITY DEFINER, kiểm tra quyền MỘT lần, rồi gộp 5 phép đếm
-- persons vào MỘT lượt quét bằng count(*) filter (…). branches quét
-- riêng (bảng nhỏ).
--
-- Giữ nguyên hành vi cũ: người KHÔNG xem được clan nhận toàn số 0
-- (dashboard render trạng thái rỗng), không báo lỗi. Platform admin
-- vẫn thấy số thật (persons_select cũ cũng cho phép is_platform_admin).
-- Chữ ký (cột/thứ tự) không đổi ⇒ database.types.ts không đổi.

create or replace function public.get_clan_stats(target_clan uuid)
  returns table (
    total_persons int,
    males int,
    females int,
    living int,
    deceased int,
    max_generation int,
    branches int
  )
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if not (
      coalesce(public.is_clan_member(target_clan), false)
      or public.is_platform_admin()
    ) then
      return query select 0, 0, 0, 0, 0, null::int, 0;
      return;
    end if;

    return query
    select
      pp.total,
      pp.males,
      pp.females,
      pp.living,
      pp.deceased,
      pp.max_generation,
      (select count(*)::int
         from public.branches b
        where b.clan_id = target_clan
          and b.deleted_at is null)
    from (
      select
        count(*)::int                                        as total,
        count(*) filter (where p.gender = 'M')::int          as males,
        count(*) filter (where p.gender = 'F')::int          as females,
        count(*) filter (where p.is_living = true)::int      as living,
        count(*) filter (where p.is_living = false)::int     as deceased,
        max(p.generation)::int                               as max_generation
      from public.persons p
      where p.clan_id = target_clan
        and p.deleted_at is null
    ) pp;
  end;
  $$;

revoke execute on function public.get_clan_stats(uuid) from public;
grant execute on function public.get_clan_stats(uuid) to authenticated;
