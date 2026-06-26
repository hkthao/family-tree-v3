-- "Thẻ khoe" chia sẻ: khi user bấm chia sẻ, lưu lại ẢNH thiệp + tạo
-- link công khai /khoe/:token hiển thị đúng tấm thiệp đó. Hạn tối đa
-- 3 tháng; cron xoá ảnh + row khi hết hạn.

create table public.card_shares (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  clan_id     uuid not null references public.clans(id) on delete cascade,
  person_id   uuid references public.persons(id) on delete set null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  image_path  text not null,            -- path trong bucket card-shares
  title       text not null,
  subtitle    text,                     -- "Đời thứ N · Dòng họ X"
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index card_shares_clan_idx on public.card_shares (clan_id);
create index card_shares_expires_idx on public.card_shares (expires_at);

alter table public.card_shares enable row level security;

-- Trang công khai: anon + authenticated đọc khi CHƯA hết hạn.
create policy card_shares_public_read
  on public.card_shares for select
  to anon, authenticated
  using (expires_at > now());

-- Thành viên dòng họ tạo thẻ của mình.
create policy card_shares_member_insert
  on public.card_shares for insert
  to authenticated
  with check (public.is_clan_member(clan_id) and created_by = auth.uid());

-- Người tạo (hoặc người sửa được dòng họ) cập nhật / gỡ sớm.
create policy card_shares_owner_update
  on public.card_shares for update
  to authenticated
  using (created_by = auth.uid() or public.can_edit_clan(clan_id))
  with check (created_by = auth.uid() or public.can_edit_clan(clan_id));

create policy card_shares_owner_delete
  on public.card_shares for delete
  to authenticated
  using (created_by = auth.uid() or public.can_edit_clan(clan_id));

-- ─── Bucket công khai cho ảnh thẻ ──────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('card-shares', 'card-shares', true)
  on conflict (id) do nothing;

-- Public bucket → đọc qua URL công khai. Upload: thành viên đăng nhập.
-- SELECT cần cho upload upsert (storage kiểm tra object tồn tại trước).
create policy "card-shares select auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'card-shares');
create policy "card-shares insert auth"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'card-shares');
create policy "card-shares update auth"
  on storage.objects for update to authenticated
  using (bucket_id = 'card-shares')
  with check (bucket_id = 'card-shares');

-- ─── Cleanup: xoá ảnh + row khi hết hạn ────────────────────────────
create or replace function public.delete_expired_card_shares()
  returns integer
  language plpgsql
  security definer
  set search_path = public, storage, pg_temp
  as $$
  declare n integer;
  begin
    -- Xoá object trong storage trước (theo image_path của row hết hạn).
    delete from storage.objects o
      using public.card_shares c
      where o.bucket_id = 'card-shares'
        and o.name = c.image_path
        and c.expires_at <= now();
    delete from public.card_shares where expires_at <= now();
    get diagnostics n = row_count;
    return n;
  end; $$;

revoke all on function public.delete_expired_card_shares() from public, anon, authenticated;

-- Chạy hằng ngày 03:17 — CHỈ khi pg_cron có (local dev không có →
-- no-op, operator tự gọi hàm hoặc bật pg_cron trên prod self-host).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'delete-expired-card-shares';
    perform cron.schedule(
      'delete-expired-card-shares', '17 3 * * *',
      $cron$select public.delete_expired_card_shares();$cron$
    );
  end if;
end $$;
