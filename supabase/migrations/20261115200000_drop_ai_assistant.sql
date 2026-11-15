-- Gỡ hoàn toàn trợ lý AI (hỏi đáp, nhập liệu bằng AI) và hạn mức/credit đi kèm.
--
-- KHÔNG HOÀN TÁC ĐƯỢC: xoá lịch sử chat (ai_messages), nhật ký chi phí (ai_usage), sổ credit
-- (credit_ledger), khoá nhà cung cấp AI (ai_provider_keys) và hạn mức theo dòng họ. Backup trước khi áp lên prod.
--
-- GIỮ LẠI: fb_page_credentials (token Facebook của Podcast, chỉ mượn khuôn của ai_provider_keys),
-- biến AI_KEY_ENCRYPTION_KEY (vẫn dùng mã hoá token Facebook), và bảng api_tokens (kết nối AI bên ngoài/MCP).
--
-- Mọi lệnh dùng IF EXISTS để chạy được cả trên DB đã thiếu một phần (vd. môi trường dev chưa áp hết migration).

-- Hàm báo cáo / guard của quản trị AI.
drop function if exists public.ai_usage_overview(integer);
drop function if exists public.ai_usage_daily(integer);
drop function if exists public.ai_usage_by_model(integer);
drop function if exists public.ai_usage_by_clan(integer);
drop function if exists public.ai_spend_today();
drop function if exists public.ai_provider_keys_status();
drop function if exists public.ai_rate_turn(text, integer);
drop function if exists public.ai_admin_guard();

-- Credit / hạn mức (chỉ AI dùng: resource 'ai_request').
drop function if exists public.credit_my_quota(text);
drop function if exists public.credit_overview();
drop function if exists public.credit_consume(uuid, text, integer, text);
drop function if exists public.credit_ensure_monthly_free(uuid, text);
drop function if exists public.credit_grant(uuid, text, integer, text, text, timestamptz, uuid, uuid);
drop function if exists public.credit_monthly_free_amount();
drop view if exists public.credit_balance;
drop table if exists public.credit_ledger cascade;

-- Lịch sử chat + nhật ký sử dụng + khoá nhà cung cấp.
drop function if exists public.ai_messages_purge_expired();
drop function if exists public.ai_messages_trim() cascade;
drop table if exists public.ai_messages cascade;
drop table if exists public.ai_usage cascade;
drop table if exists public.ai_provider_keys cascade;

-- Hạn mức theo dòng họ.
alter table public.clans drop column if exists ai_daily_limit;
alter table public.clans drop column if exists ai_monthly_limit;

-- Cấu hình nền tảng và cờ tính năng của dòng họ.
delete from public.platform_settings where key like 'ai.%';
update public.clans
   set disabled_features = array_remove(disabled_features, 'ai_assistant')
 where 'ai_assistant' = any(disabled_features);
