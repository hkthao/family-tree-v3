-- ============================================================================
-- Sổ vàng công đức (honor_entries)
--
-- Vinh danh đóng góp/thành tích của dòng họ: tiền công đức (quỹ đinh, khuyến
-- học, xây từ đường), công sức, thành tích học tập… Thay bảng đá ở nhà thờ họ
-- bằng "bảng vàng" số — tạo tự hào, lý do mở app xem & khoe con cháu.
--
-- Đọc: thành viên dòng họ. Ghi/sửa/xoá: can_edit_clan (trưởng họ/thủ quỹ).
-- Đây là SỔ GHI CHÉP MINH BẠCH, không phải cổng thanh toán.
-- ============================================================================

create table public.honor_entries (
  id           uuid primary key default gen_random_uuid(),
  clan_id      uuid not null references public.clans(id) on delete cascade,
  -- Liên kết người trong cây (tuỳ chọn) — để mở trang cá nhân; honoree_name
  -- luôn có để hiển thị (kể cả người ngoài cây / con cháu chưa lên cây).
  person_id    uuid references public.persons(id) on delete set null,
  honoree_name text not null,
  category     text not null default 'donation_money'
                 check (category in ('donation_money', 'donation_labor', 'academic', 'other')),
  -- Số tiền (VND, số nguyên) — chỉ dùng cho category tiền; null với công sức/học tập.
  amount       numeric(14, 0) check (amount is null or amount >= 0),
  note         text,
  occurred_on  date,
  sort         int not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint honor_name_len check (char_length(honoree_name) <= 200),
  constraint honor_note_len check (note is null or char_length(note) <= 2000)
);

create index honor_entries_clan_idx
  on public.honor_entries (clan_id) where deleted_at is null;
create index honor_entries_clan_cat_idx
  on public.honor_entries (clan_id, category) where deleted_at is null;

create trigger honor_entries_set_updated_at
  before update on public.honor_entries
  for each row execute function public.set_updated_at();

-- ─── RLS (đọc: thành viên/admin; ghi: can_edit_clan) ─────────────────────────
alter table public.honor_entries enable row level security;

create policy honor_entries_select on public.honor_entries for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy honor_entries_insert on public.honor_entries for insert
  with check (public.can_edit_clan(clan_id));
create policy honor_entries_update on public.honor_entries for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy honor_entries_delete on public.honor_entries for delete
  using (public.can_edit_clan(clan_id));

revoke all on public.honor_entries from anon;
