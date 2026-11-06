-- Địa chỉ để hiện trên "Bản đồ" của dòng họ (docs/plan-thong-ke-ban-do.md):
--   * person_addresses: nơi ở hiện tại của một người (tỉnh → xã/phường chọn từ danh mục), RIÊNG bảng
--     để không bao giờ lọt vào view/RPC công khai đang select từ `persons`. Chỉ thành viên dòng họ xem.
--   * resting_places / heritage_items: thêm tỉnh + xã/phường (cạnh cột `address` tự do có sẵn).
--   * clan_map_stats(): số đếm theo tỉnh cho bản đồ (chỉ số đếm, không trả tên / địa chỉ chi tiết).

-- ─── person_addresses ───────────────────────────────────────────────
create table public.person_addresses (
  person_id     uuid primary key references public.persons(id) on delete cascade,
  clan_id       uuid not null references public.clans(id) on delete cascade,
  province_code text references public.vn_provinces(code) on update cascade,
  ward_code     text references public.vn_wards(code) on update cascade,
  street_detail text,
  country       text not null default 'VN',
  updated_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  constraint person_addresses_street_len check (street_detail is null or char_length(street_detail) <= 300)
);

create index person_addresses_clan_province_idx on public.person_addresses (clan_id, province_code);

-- clan_id luôn lấy từ người đó (không tin giá trị client gửi lên) và ghi lại người sửa.
create or replace function public.person_addresses_before_write()
  returns trigger
  language plpgsql
  as $$
  begin
    select p.clan_id into new.clan_id from public.persons p where p.id = new.person_id;
    if new.clan_id is null then
      raise exception 'person_not_found';
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
  end; $$;

create trigger person_addresses_before_write
  before insert or update on public.person_addresses
  for each row execute function public.person_addresses_before_write();

alter table public.person_addresses enable row level security;

-- Chỉ thành viên dòng họ được xem (kể cả platform admin qua is_clan_member).
create policy person_addresses_select on public.person_addresses
  for select to authenticated using (public.is_clan_member(clan_id));
create policy person_addresses_insert on public.person_addresses
  for insert to authenticated with check (public.can_edit_clan(clan_id));
create policy person_addresses_update on public.person_addresses
  for update to authenticated using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy person_addresses_delete on public.person_addresses
  for delete to authenticated using (public.can_edit_clan(clan_id));

-- ─── tỉnh + xã/phường cho mộ phần và di sản ─────────────────────────
alter table public.resting_places
  add column province_code text references public.vn_provinces(code) on update cascade,
  add column ward_code     text references public.vn_wards(code) on update cascade;
alter table public.heritage_items
  add column province_code text references public.vn_provinces(code) on update cascade,
  add column ward_code     text references public.vn_wards(code) on update cascade;

create index resting_places_province_idx on public.resting_places (clan_id, province_code) where deleted_at is null;
create index heritage_items_province_idx on public.heritage_items (clan_id, province_code) where deleted_at is null;

-- ─── thống kê cho bản đồ ────────────────────────────────────────────
-- Trả về { people: {mã_tỉnh: n}, graves: {...}, heritage: {...}, missing: {...}, total: {...} }.
-- SECURITY INVOKER: RLS vẫn áp dụng; ngoài ra tự chặn người không thuộc dòng họ để không lộ số liệu.
create or replace function public.clan_map_stats(p_clan uuid, p_include_deceased boolean default true)
  returns jsonb
  language plpgsql
  stable
  security invoker
  set search_path = public
  as $$
  declare
    v_people   jsonb;
    v_graves   jsonb;
    v_heritage jsonb;
    v_p_total  int;
    v_p_have   int;
    v_g_total  int;
    v_g_have   int;
    v_h_total  int;
    v_h_have   int;
  begin
    if not public.is_clan_member(p_clan) then
      raise exception 'forbidden' using errcode = '42501';
    end if;

    -- Người: chỉ người có địa chỉ trong nước (country = VN) và đã chọn tỉnh.
    select coalesce(jsonb_object_agg(province_code, n), '{}'::jsonb), coalesce(sum(n), 0)
      into v_people, v_p_have
    from (
      select a.province_code, count(*)::int as n
      from public.person_addresses a
      join public.persons p on p.id = a.person_id and p.deleted_at is null
      where a.clan_id = p_clan and a.province_code is not null and a.country = 'VN'
        and (p_include_deceased or p.is_living)
      group by a.province_code
    ) s;
    select count(*)::int into v_p_total
      from public.persons p
      where p.clan_id = p_clan and p.deleted_at is null and (p_include_deceased or p.is_living);

    select coalesce(jsonb_object_agg(province_code, n), '{}'::jsonb), coalesce(sum(n), 0)
      into v_graves, v_g_have
    from (
      select province_code, count(*)::int as n from public.resting_places
      where clan_id = p_clan and deleted_at is null and province_code is not null
      group by province_code
    ) s;
    select count(*)::int into v_g_total from public.resting_places where clan_id = p_clan and deleted_at is null;

    select coalesce(jsonb_object_agg(province_code, n), '{}'::jsonb), coalesce(sum(n), 0)
      into v_heritage, v_h_have
    from (
      select province_code, count(*)::int as n from public.heritage_items
      where clan_id = p_clan and deleted_at is null and province_code is not null
      group by province_code
    ) s;
    select count(*)::int into v_h_total from public.heritage_items where clan_id = p_clan and deleted_at is null;

    return jsonb_build_object(
      'people', v_people, 'graves', v_graves, 'heritage', v_heritage,
      'total', jsonb_build_object('people', v_p_total, 'graves', v_g_total, 'heritage', v_h_total),
      'missing', jsonb_build_object(
        'people', greatest(v_p_total - v_p_have, 0),
        'graves', greatest(v_g_total - v_g_have, 0),
        'heritage', greatest(v_h_total - v_h_have, 0))
    );
  end; $$;

revoke all on function public.clan_map_stats(uuid, boolean) from public, anon;
grant execute on function public.clan_map_stats(uuid, boolean) to authenticated;
