-- OAuth cũng cấp được token ADMIN HỆ THỐNG (không gắn dòng họ) — chỉ cho admin hệ thống, hạn trượt 30 ngày (server MCP đặt).
-- Mã cấp quyền (oauth_codes) vì thế cho phép clan_id null khi scope = 'admin', và ngược lại.
alter table public.oauth_codes alter column clan_id drop not null;
alter table public.oauth_codes drop constraint if exists oauth_codes_scope_check;
alter table public.oauth_codes add constraint oauth_codes_scope_check check (scope in ('read', 'propose', 'write', 'admin'));
alter table public.oauth_codes drop constraint if exists oauth_codes_admin_clan;
alter table public.oauth_codes add constraint oauth_codes_admin_clan check ((scope = 'admin') = (clan_id is null));
