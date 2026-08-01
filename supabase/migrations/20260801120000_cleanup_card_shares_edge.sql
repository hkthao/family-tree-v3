-- Chuyển dọn card_shares hết hạn từ pg_cron (SQL) sang edge function
-- `cleanup-card-shares` (Storage API) — xem supabase/functions/cleanup-card-shares.
--
-- Lý do: hàm cũ delete_expired_card_shares() xoá thẳng storage.objects
-- bằng SQL, bị trigger protect_objects_delete của storage self-host chặn
-- (ERRCODE 42501) ⇒ job fail mỗi ngày, không dọn được row lẫn file.
-- Edge function dùng storage.remove() nên xoá được FILE thật (không mồ côi).

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'delete-expired-card-shares';
  end if;
end $$;

drop function if exists public.delete_expired_card_shares();
