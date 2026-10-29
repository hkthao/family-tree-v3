-- Dòng thời gian của một người: các mốc theo năm trong đời (sinh → mất), do người
-- có quyền sửa dòng họ thêm / sửa / xoá bằng form ở trang chi tiết.
-- Chưa có dòng nào → app dựng tạm từ các ý "Năm …" trong tiểu sử (dữ liệu lịch sử).

create table if not exists public.person_timeline (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  year int not null check (year between -3000 and 3000),
  era text,                            -- can chi: 'Nhâm Thìn'
  body text not null check (char_length(body) between 1 and 1000),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists person_timeline_person_idx
  on public.person_timeline (person_id, year, sort);

create trigger person_timeline_clan_trg
  before insert or update on public.person_timeline
  for each row execute function public.check_historical_child_clan();

alter table public.person_timeline enable row level security;

create policy "person_timeline_select" on public.person_timeline for select
  to authenticated
  using (exists (
    select 1 from public.clans c
    where c.id = person_timeline.clan_id
      and (c.visibility = 'public'
           or public.is_clan_member(c.id)
           or public.is_platform_admin())
  ));

create policy "person_timeline_editor_write" on public.person_timeline for all
  to authenticated
  using (public.can_edit_clan(clan_id) or public.is_platform_admin())
  with check (public.can_edit_clan(clan_id) or public.is_platform_admin());

-- Trang xem thử công khai của dòng họ lịch sử (khách chưa đăng nhập).
create policy "person_timeline_anon_historical_select" on public.person_timeline for select
  to anon
  using (public.is_public_historical_clan(clan_id));
