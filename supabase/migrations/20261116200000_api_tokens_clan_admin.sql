-- Admin dòng họ quản lý MỌI token AI của dòng họ mình (không chỉ token của chính họ): xem ai đang cấp quyền cho AI
-- vào dữ liệu họ và thu hồi ngay khi nghi ngờ. Giới hạn đúng một dòng họ: chỉ token có clan_id = dòng họ họ làm admin.
-- Token admin hệ thống (clan_id null) và token dòng họ khác không lọt vào. Vẫn chỉ ĐỌC + đặt revoked_at (grant theo cột
-- không đổi), không thấy bản băm; TẠO token vẫn chỉ cho chính mình.

drop policy if exists api_tokens_clan_admin_select on public.api_tokens;
create policy api_tokens_clan_admin_select on public.api_tokens for select to authenticated
  using (clan_id is not null and public.is_clan_admin(clan_id));

drop policy if exists api_tokens_clan_admin_update on public.api_tokens;
create policy api_tokens_clan_admin_update on public.api_tokens for update to authenticated
  using (clan_id is not null and public.is_clan_admin(clan_id))
  with check (clan_id is not null and public.is_clan_admin(clan_id));
