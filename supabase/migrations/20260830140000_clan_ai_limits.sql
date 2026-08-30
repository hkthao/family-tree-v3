-- ============================================================================
-- Hạn mức trợ lý AI THEO TỪNG DÒNG HỌ.
--
-- Trước đây trần "200 lượt/ngày/dòng họ" là hằng số nằm trong mã Edge
-- Function: muốn nới cho một dòng họ đang họp việc họ, hay siết một dòng
-- họ đang đốt tiền, đều phải sửa mã rồi deploy lại — nghĩa là trên thực
-- tế không ai làm.
--
-- Đi theo đúng khuôn mẫu `max_persons` / `max_users` đã có: cột nằm trên
-- `clans`, mặc định NULL = "dùng mức chung của nền tảng", và chỉ platform
-- admin sửa được (trigger protect_clan_privileged_cols).
--
-- Vì sao NULL chứ không phải chép sẵn con số 200 vào từng dòng họ: chép
-- sẵn thì sau này đổi mức chung sẽ không áp cho ai cả, mà chẳng ai hiểu
-- tại sao.
-- ============================================================================

alter table public.clans
  add column if not exists ai_daily_limit int,
  add column if not exists ai_monthly_limit int;

alter table public.clans
  drop constraint if exists clans_ai_daily_limit_positive,
  add constraint clans_ai_daily_limit_positive
    check (ai_daily_limit is null or ai_daily_limit >= 0);

alter table public.clans
  drop constraint if exists clans_ai_monthly_limit_positive,
  add constraint clans_ai_monthly_limit_positive
    check (ai_monthly_limit is null or ai_monthly_limit >= 0);

comment on column public.clans.ai_daily_limit is
  'Trần lượt hỏi trợ lý mỗi ngày cho dòng họ này. NULL = dùng ai.clan_daily_limit.';
comment on column public.clans.ai_monthly_limit is
  'Trần lượt hỏi trợ lý mỗi tháng. NULL = dùng ai.clan_monthly_limit (0 = không giới hạn).';

-- ─── Chỉ platform admin đổi được ──────────────────────────────────────
-- Bổ sung vào trigger sẵn có. Không thêm thì trưởng họ tự nới trần cho
-- dòng họ mình được — mà đây là con số dính tới tiền của nền tảng.
create or replace function public.protect_clan_privileged_cols()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_platform_admin() then
    if new.max_persons is distinct from old.max_persons then
      raise exception 'Only platform admin can change max_persons';
    end if;
    if new.max_users is distinct from old.max_users then
      raise exception 'Only platform admin can change max_users';
    end if;
    if new.max_memory_rooms is distinct from old.max_memory_rooms then
      raise exception 'Only platform admin can change max_memory_rooms';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Only platform admin can transfer clan ownership';
    end if;
    if new.ai_daily_limit is distinct from old.ai_daily_limit then
      raise exception 'Only platform admin can change ai_daily_limit';
    end if;
    if new.ai_monthly_limit is distinct from old.ai_monthly_limit then
      raise exception 'Only platform admin can change ai_monthly_limit';
    end if;
  end if;
  return new;
end;
$$;

-- ─── Mức chung của nền tảng ───────────────────────────────────────────
-- Đây là con số áp cho mọi dòng họ chưa đặt riêng. 0 = không giới hạn.
insert into public.platform_settings (key, value)
values ('ai.clan_daily_limit', '200'),
       ('ai.clan_monthly_limit', '0')
on conflict (key) do nothing;
