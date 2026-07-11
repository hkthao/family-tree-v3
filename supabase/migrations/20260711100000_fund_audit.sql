-- ============================================================================
-- Nhật ký thay đổi Quỹ họ (fund_audit) — minh bạch tuyệt đối.
--
-- Mọi thao tác thêm/sửa/xoá trên fund_transactions được ghi lại tự động (trigger)
-- vào bảng CHỈ-GHI-THÊM này: ai (actor), làm gì (action), khi nào, ảnh chụp số
-- liệu. Thành viên đọc được để giám sát; KHÔNG ai ghi/sửa/xoá trực tiếp (chỉ
-- trigger security-definer viết). Xoá quỹ = soft-delete (deleted_at) → action 'delete'.
-- ============================================================================

create table public.fund_audit (
  id           uuid primary key default gen_random_uuid(),
  clan_id      uuid not null references public.clans(id) on delete cascade,
  txn_id       uuid,                 -- id giao dịch (không FK: giữ cả khi bị xoá)
  action       text not null check (action in ('insert', 'update', 'delete')),
  actor_id     uuid,
  actor_name   text,                 -- chụp tên lúc thao tác (giữ dù đổi tên sau)
  direction    text,
  amount       numeric(14, 0),
  fund         text,
  occurred_on  date,
  note         text,
  at           timestamptz not null default now()
);

create index fund_audit_clan_idx on public.fund_audit (clan_id, at desc);

-- Trigger ghi audit — SECURITY DEFINER để ghi được bảng dù người dùng không có
-- quyền INSERT trực tiếp lên fund_audit.
create or replace function public.fund_audit_trg()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_action text;
  v_row public.fund_transactions;
  v_name text;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_row := new;
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_row := old;
  else -- UPDATE: soft-delete (deleted_at mới có) tính là 'delete', còn lại 'update'
    if new.deleted_at is not null and old.deleted_at is null then
      v_action := 'delete';
    else
      v_action := 'update';
    end if;
    v_row := new;
  end if;

  select display_name into v_name from public.profiles where id = auth.uid();

  insert into public.fund_audit (
    clan_id, txn_id, action, actor_id, actor_name,
    direction, amount, fund, occurred_on, note
  ) values (
    v_row.clan_id, v_row.id, v_action, auth.uid(), v_name,
    v_row.direction, v_row.amount, v_row.fund, v_row.occurred_on, v_row.note
  );
  return null; -- AFTER trigger
end;
$$;

create trigger fund_transactions_audit
  after insert or update or delete on public.fund_transactions
  for each row execute function public.fund_audit_trg();

-- RLS: đọc = thành viên/admin; KHÔNG có policy ghi → chỉ trigger (definer) viết.
alter table public.fund_audit enable row level security;

create policy fund_audit_select on public.fund_audit for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

revoke all on public.fund_audit from anon;
