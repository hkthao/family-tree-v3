-- ============================================================================
-- Quỹ họ minh bạch (fund_transactions)
--
-- Sổ thu/chi quỹ dòng họ — quỹ đinh, khuyến học, xây từ đường… Con cháu vào xem
-- tiền được dùng đúng mục đích → minh bạch, giảm xích mích. Đây là SỔ GHI CHÉP,
-- không phải cổng thanh toán.
--
-- Đọc: mọi thành viên dòng họ (minh bạch). Ghi/sửa/xoá: can_edit_clan (trưởng
-- họ / thủ quỹ). Xoá mềm (deleted_at) để giữ dấu vết. Nhiều "quỹ" phân biệt qua
-- cột `fund` (tên quỹ).
-- ============================================================================

create table public.fund_transactions (
  id           uuid primary key default gen_random_uuid(),
  clan_id      uuid not null references public.clans(id) on delete cascade,
  -- 'in' = thu (đóng góp), 'out' = chi.
  direction    text not null check (direction in ('in', 'out')),
  amount       numeric(14, 0) not null check (amount > 0),
  -- Tên quỹ để phân nhóm số dư (vd "Quỹ chung", "Khuyến học", "Xây từ đường").
  fund         text not null default 'Quỹ chung',
  -- Mục đích (vd "Đóng góp giỗ tổ", "Mua vật liệu"), tự do.
  category     text,
  occurred_on  date not null default current_date,
  note         text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint fund_fund_len check (char_length(fund) <= 100),
  constraint fund_cat_len check (category is null or char_length(category) <= 100),
  constraint fund_note_len check (note is null or char_length(note) <= 2000)
);

create index fund_tx_clan_idx
  on public.fund_transactions (clan_id, occurred_on desc) where deleted_at is null;

create trigger fund_tx_set_updated_at
  before update on public.fund_transactions
  for each row execute function public.set_updated_at();

-- ─── RLS (đọc: thành viên/admin; ghi: can_edit_clan) ─────────────────────────
alter table public.fund_transactions enable row level security;

create policy fund_tx_select on public.fund_transactions for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy fund_tx_insert on public.fund_transactions for insert
  with check (public.can_edit_clan(clan_id));
create policy fund_tx_update on public.fund_transactions for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy fund_tx_delete on public.fund_transactions for delete
  using (public.can_edit_clan(clan_id));

revoke all on public.fund_transactions from anon;
