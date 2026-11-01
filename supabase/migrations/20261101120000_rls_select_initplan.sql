-- Tối ưu RLS SELECT của 4 bảng nóng (persons, families, branches, clan_members):
-- chính sách cũ `is_clan_member(clan_id) OR is_platform_admin()` gọi hàm SECURITY DEFINER
-- (is_platform_admin → đọc profiles; clan_role → is_caller_suspended + tra clan_members) CHO TỪNG DÒNG,
-- nên đọc một cây hàng trăm người tốn hàng trăm lần tra cứu (profiles bị seq scan hàng triệu lần).
-- Bản mới: is_platform_admin() chạy một lần (InitPlan) và tập clan của người gọi tính một lần (hashed SubPlan).
-- Ngữ nghĩa GIỮ NGUYÊN: thành viên (không bị khoá) của clan hoặc platform admin.
create or replace function public.my_clan_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select clan_id from public.clan_members
  where user_id = auth.uid() and not public.is_caller_suspended()
$$;

alter policy persons_select on public.persons
  using ((select public.is_platform_admin()) or clan_id in (select public.my_clan_ids()));
alter policy families_select on public.families
  using ((select public.is_platform_admin()) or clan_id in (select public.my_clan_ids()));
alter policy branches_select on public.branches
  using ((select public.is_platform_admin()) or clan_id in (select public.my_clan_ids()));
alter policy clan_members_member_select on public.clan_members
  using ((select public.is_platform_admin()) or clan_id in (select public.my_clan_ids()));
