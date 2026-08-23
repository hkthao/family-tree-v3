-- ============================================================================
-- ai_messages — lịch sử trò chuyện với trợ lý (GĐ 2).
--
-- Vì sao lưu ở server chứ không chỉ localStorage: dữ liệu Umami tháng 8 cho
-- thấy nhập liệu nặng diễn ra trên desktop còn xem trên mobile — một người
-- chuyển máy là hành vi ĐÃ quan sát được. Mất mạch trò chuyện khi đổi máy là
-- bất tiện thật. localStorage tụt xuống làm cache để vẽ ngay.
--
-- Bảng này CÓ nội dung, khác hẳn ai_usage. Ba biện pháp thu nhỏ bề mặt:
--   1. RLS chỉ cho CHÍNH CHỦ đọc — xem cảnh báo ở policy bên dưới.
--   2. Cắt vòng 40 tin mỗi (owner, clan) bằng trigger.
--   3. TTL 90 ngày, cấu hình ở platform_settings['ai.chat_retention_days'].
--
-- KHÔNG lưu tool result hay payload bóc tách: đó là khối PII to nhất, mà lại
-- tái tạo được từ chính DB, nên lưu chỉ là nhân bản rủi ro.
--
-- Xem docs/plan-ai-tro-ly.md §Hội thoại lưu ở server.
-- ============================================================================

create table public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  -- CASCADE, không phải SET NULL: xoá tài khoản thì nội dung phải đi theo.
  -- delete_my_account() xoá auth.users → cascade qua profiles → tới đây,
  -- nên không cần sửa hàm đó; chỉ cần khai FK cho đúng.
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  clan_id    uuid not null references public.clans(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  kind       text not null default 'qa' check (kind in ('qa', 'extract')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- Truy vấn duy nhất là "40 tin gần nhất của tôi trong dòng họ này".
create index ai_messages_owner_clan_idx
  on public.ai_messages (owner_id, clan_id, created_at desc);

alter table public.ai_messages enable row level security;

-- ⚠️ CHỖ DỄ SAI NHẤT CỦA CẢ TÍNH NĂNG.
--
-- Phải là `owner_id = auth.uid()`. TUYỆT ĐỐI không dùng
-- `is_clan_member(clan_id)` — helper đó có mặt ở gần như mọi bảng khác nên
-- phản xạ tự nhiên là gõ nó ra, nhưng ở đây nó cho trưởng họ đọc câu hỏi
-- riêng tư của con cháu, biến trợ lý thành công cụ giám sát gia đình.
--
-- Trưởng họ trả tiền chỉ được thấy AI TIÊU BAO NHIÊU LƯỢT (credit_ledger,
-- GĐ 3), không phải nội dung. Platform admin cũng KHÔNG có quyền đọc ở đây.
create policy ai_messages_own_select on public.ai_messages for select
  using (owner_id = auth.uid());

create policy ai_messages_own_delete on public.ai_messages for delete
  using (owner_id = auth.uid());

-- Không có policy INSERT/UPDATE: chỉ Edge Function (service role) ghi, sau
-- khi một lượt hỏi đáp thành công. Client không tự bịa được lịch sử.
revoke all on public.ai_messages from anon;
grant select, delete on public.ai_messages to authenticated;

comment on table public.ai_messages is
  'Lịch sử trò chuyện với trợ lý. CHỈ chính chủ đọc — không dùng is_clan_member ở đây.';

-- ─── Cắt vòng 40 tin mỗi (owner, clan) ────────────────────────────────
-- Làm ngay lúc ghi thay vì cron: rẻ (index đã có), và giữ trần đúng nghĩa
-- thay vì "đúng sau khi cron chạy".
create or replace function public.ai_messages_trim()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  delete from public.ai_messages m
  where m.owner_id = new.owner_id
    and m.clan_id = new.clan_id
    and m.id not in (
      select id from public.ai_messages
      where owner_id = new.owner_id and clan_id = new.clan_id
      order by created_at desc, id desc
      limit 40
    );
  return null;
end;
$$;

create trigger ai_messages_trim_after_insert
  after insert on public.ai_messages
  for each row execute function public.ai_messages_trim();

-- ─── Dọn theo TTL ─────────────────────────────────────────────────────
-- Gọi từ cron host (giống weekly-digest). Đọc số ngày từ platform_settings
-- để đổi được mà không cần deploy.
create or replace function public.ai_messages_purge_expired()
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  days int;
  removed int;
begin
  select coalesce(nullif(value, '')::int, 90) into days
  from public.platform_settings where key = 'ai.chat_retention_days';
  days := coalesce(days, 90);

  delete from public.ai_messages
  where created_at < now() - make_interval(days => days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.ai_messages_purge_expired() from public, anon, authenticated;

insert into public.platform_settings (key, value) values
  ('ai.chat_retention_days', '90')
on conflict (key) do nothing;
