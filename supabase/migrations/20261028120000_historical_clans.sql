-- Dòng họ lịch sử (gia phả các triều vua chúa) — xem docs/plan-gia-pha-vua-chua.md.
--
-- Mỗi dữ kiện lịch sử phải truy được về nguồn (sách, quyển/tờ, trích nguyên
-- văn). Migration này thêm:
--   1. clans.kind ('family' | 'historical') + external_key (để import lại).
--   2. historical_sources  — danh mục nguồn (chính sử, nghiên cứu, tham khảo).
--   3. person_citations    — trích dẫn theo TỪNG dữ kiện của người / cuộc hôn nhân.
--   4. person_reigns       — trị vì: miếu hiệu, niên hiệu, năm trị vì.
--   5. person_titles       — tước hiệu (hoàng hậu, phi, vương, công chúa…).
--   6. persons.adoptive_family_id — con nuôi / thừa tự (dùng cả cho họ thường).
--   7. persons/families.external_key — khoá ổn định cho script import.
--   8. persons.{birth,death}_date_qualifier — "khoảng / trước / sau" năm.

-- 1. clans ------------------------------------------------------------------
alter table public.clans
  add column if not exists kind text not null default 'family'
    check (kind in ('family', 'historical')),
  add column if not exists external_key text unique;

-- Chỉ platform admin (hoặc service role, auth.uid() null) được tạo/đổi họ
-- lịch sử — tránh họ thường tự gắn nhãn "dữ liệu lịch sử".
create or replace function public.protect_clan_kind()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind <> 'family' or new.external_key is not null then
      raise exception 'Only platform admin can create historical clans';
    end if;
  elsif new.kind is distinct from old.kind
     or new.external_key is distinct from old.external_key then
    raise exception 'Only platform admin can change clan kind';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_clan_kind_trg on public.clans;
create trigger protect_clan_kind_trg
  before insert or update on public.clans
  for each row
  execute function public.protect_clan_kind();

-- 6–8. persons / families ---------------------------------------------------
alter table public.persons
  add column if not exists adoptive_family_id uuid,
  add column if not exists external_key text,
  add column if not exists birth_date_qualifier text
    check (birth_date_qualifier in ('circa', 'before', 'after')),
  add column if not exists death_date_qualifier text
    check (death_date_qualifier in ('circa', 'before', 'after'));

alter table public.persons
  drop constraint if exists persons_adoptive_family_fk,
  add constraint persons_adoptive_family_fk
    foreign key (adoptive_family_id) references public.families(id)
      on delete set null
      deferrable initially deferred,
  drop constraint if exists persons_clan_external_key_uniq,
  add constraint persons_clan_external_key_uniq unique (clan_id, external_key);

alter table public.families
  add column if not exists external_key text,
  drop constraint if exists families_clan_external_key_uniq,
  add constraint families_clan_external_key_uniq unique (clan_id, external_key);

-- 2. historical_sources -----------------------------------------------------
create table if not exists public.historical_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- 'TT', 'CM', 'DNTL'…
  title text not null,
  author text,
  edition text,                       -- bản gốc / bản khắc
  translator text,                    -- bản dịch dùng để trích
  published_year int,
  tier text not null check (tier in ('A', 'B', 'C')),
  url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.historical_sources enable row level security;

-- Danh mục nguồn là thông tin công khai (kể cả khách xem trang share).
create policy "historical_sources_public_select"
  on public.historical_sources for select
  to anon, authenticated
  using (true);

create policy "historical_sources_admin_write"
  on public.historical_sources for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- 3. person_citations -------------------------------------------------------
create table if not exists public.person_citations (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  person_id uuid references public.persons(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  -- 'existence','full_name','birth','death','parents','adoptive_parents',
  -- 'posthumous_name','courtesy_name','nickname','reign','title','union'…
  field text not null,
  value text,                         -- giá trị nguồn này ghi (giữ dị bản)
  source_id uuid not null references public.historical_sources(id),
  locator text not null,              -- 'Bản kỷ, Q.5, tờ 12a'
  quote text not null,                -- trích ngắn nguyên văn bản dịch
  confidence text not null
    check (confidence in ('confirmed', 'single_source', 'disputed', 'legendary')),
  note text,
  reviewed_by text,                   -- tên người duyệt (hiển thị công khai)
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint person_citations_target check (
    (person_id is not null) <> (family_id is not null)
  )
);

create index if not exists person_citations_person_idx
  on public.person_citations (person_id) where person_id is not null;
create index if not exists person_citations_family_idx
  on public.person_citations (family_id) where family_id is not null;
create index if not exists person_citations_clan_idx
  on public.person_citations (clan_id);

-- 4. person_reigns ----------------------------------------------------------
create table if not exists public.person_reigns (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  dynasty text not null,              -- 'Trần'
  ordinal int,                        -- vua thứ mấy của triều
  role text not null default 'emperor'
    check (role in ('emperor', 'retired_emperor', 'lord', 'regent')),
  temple_name text,                   -- miếu hiệu
  era_names jsonb not null default '[]'::jsonb,  -- [{name, from_year, to_year}]
  reign_start_year int,
  reign_end_year int,
  notes text,
  created_at timestamptz not null default now(),
  constraint person_reigns_years check (
    reign_start_year is null or reign_end_year is null
    or reign_start_year <= reign_end_year
  )
);

create index if not exists person_reigns_person_idx
  on public.person_reigns (person_id);

-- 5. person_titles ----------------------------------------------------------
create table if not exists public.person_titles (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  title text not null,                -- 'Hoàng hậu', 'Thượng tướng Thái sư'…
  from_year int,
  to_year int,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists person_titles_person_idx
  on public.person_titles (person_id);

-- clan_id của bảng con phải khớp với person/family (RLS dựa trên clan_id).
create or replace function public.check_historical_child_clan()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
declare
  owner_clan uuid;
begin
  if new.person_id is not null then
    select clan_id into owner_clan from public.persons where id = new.person_id;
  elsif tg_table_name = 'person_citations' and new.family_id is not null then
    select clan_id into owner_clan from public.families where id = new.family_id;
  end if;
  if owner_clan is distinct from new.clan_id then
    raise exception 'clan_id mismatch on %', tg_table_name;
  end if;
  return new;
end;
$$;

create trigger person_citations_clan_trg
  before insert or update on public.person_citations
  for each row execute function public.check_historical_child_clan();
create trigger person_reigns_clan_trg
  before insert or update on public.person_reigns
  for each row execute function public.check_historical_child_clan();
create trigger person_titles_clan_trg
  before insert or update on public.person_titles
  for each row execute function public.check_historical_child_clan();

-- RLS cho 3 bảng con: đọc theo quyền xem dòng họ, ghi theo quyền sửa.
alter table public.person_citations enable row level security;
alter table public.person_reigns enable row level security;
alter table public.person_titles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['person_citations', 'person_reigns', 'person_titles'] loop
    execute format($f$
      create policy "%1$s_select" on public.%1$s for select
        to authenticated
        using (exists (
          select 1 from public.clans c
          where c.id = %1$s.clan_id
            and (c.visibility = 'public'
                 or public.is_clan_member(c.id)
                 or public.is_platform_admin())
        ))
    $f$, t);
    execute format($f$
      create policy "%1$s_editor_write" on public.%1$s for all
        to authenticated
        using (public.can_edit_clan(clan_id) or public.is_platform_admin())
        with check (public.can_edit_clan(clan_id) or public.is_platform_admin())
    $f$, t);
  end loop;
end
$$;
