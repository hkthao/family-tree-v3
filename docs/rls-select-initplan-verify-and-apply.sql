begin;
create temp table cnt(phase text, uid text, tbl text, n bigint);
grant all on cnt to authenticated, anon;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
insert into cnt select 'old','03034d18-8866-4246-a027-6b5bffc55fa9','persons',count(*) from persons;
insert into cnt select 'old','03034d18-8866-4246-a027-6b5bffc55fa9','families',count(*) from families;
insert into cnt select 'old','03034d18-8866-4246-a027-6b5bffc55fa9','branches',count(*) from branches;
insert into cnt select 'old','03034d18-8866-4246-a027-6b5bffc55fa9','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"205e4a8b-fa00-4d5f-a34c-a99c5b5573ef","role":"authenticated"}',true);
insert into cnt select 'old','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','persons',count(*) from persons;
insert into cnt select 'old','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','families',count(*) from families;
insert into cnt select 'old','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','branches',count(*) from branches;
insert into cnt select 'old','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"3e867b64-064d-4ae5-91a4-7377b05e9394","role":"authenticated"}',true);
insert into cnt select 'old','3e867b64-064d-4ae5-91a4-7377b05e9394','persons',count(*) from persons;
insert into cnt select 'old','3e867b64-064d-4ae5-91a4-7377b05e9394','families',count(*) from families;
insert into cnt select 'old','3e867b64-064d-4ae5-91a4-7377b05e9394','branches',count(*) from branches;
insert into cnt select 'old','3e867b64-064d-4ae5-91a4-7377b05e9394','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"68e7a2ee-d91e-4911-b3d2-f2129e3092da","role":"authenticated"}',true);
insert into cnt select 'old','68e7a2ee-d91e-4911-b3d2-f2129e3092da','persons',count(*) from persons;
insert into cnt select 'old','68e7a2ee-d91e-4911-b3d2-f2129e3092da','families',count(*) from families;
insert into cnt select 'old','68e7a2ee-d91e-4911-b3d2-f2129e3092da','branches',count(*) from branches;
insert into cnt select 'old','68e7a2ee-d91e-4911-b3d2-f2129e3092da','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into cnt select 'old','00000000-0000-4000-8000-000000000001','persons',count(*) from persons;
insert into cnt select 'old','00000000-0000-4000-8000-000000000001','families',count(*) from families;
insert into cnt select 'old','00000000-0000-4000-8000-000000000001','branches',count(*) from branches;
insert into cnt select 'old','00000000-0000-4000-8000-000000000001','clan_members',count(*) from clan_members;
reset role;
set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
insert into cnt select 'old','anon','persons',count(*) from persons;
insert into cnt select 'old','anon','families',count(*) from families;
insert into cnt select 'old','anon','branches',count(*) from branches;
insert into cnt select 'old','anon','clan_members',count(*) from clan_members;
reset role;
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

set local role authenticated; select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
insert into cnt select 'new','03034d18-8866-4246-a027-6b5bffc55fa9','persons',count(*) from persons;
insert into cnt select 'new','03034d18-8866-4246-a027-6b5bffc55fa9','families',count(*) from families;
insert into cnt select 'new','03034d18-8866-4246-a027-6b5bffc55fa9','branches',count(*) from branches;
insert into cnt select 'new','03034d18-8866-4246-a027-6b5bffc55fa9','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"205e4a8b-fa00-4d5f-a34c-a99c5b5573ef","role":"authenticated"}',true);
insert into cnt select 'new','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','persons',count(*) from persons;
insert into cnt select 'new','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','families',count(*) from families;
insert into cnt select 'new','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','branches',count(*) from branches;
insert into cnt select 'new','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"3e867b64-064d-4ae5-91a4-7377b05e9394","role":"authenticated"}',true);
insert into cnt select 'new','3e867b64-064d-4ae5-91a4-7377b05e9394','persons',count(*) from persons;
insert into cnt select 'new','3e867b64-064d-4ae5-91a4-7377b05e9394','families',count(*) from families;
insert into cnt select 'new','3e867b64-064d-4ae5-91a4-7377b05e9394','branches',count(*) from branches;
insert into cnt select 'new','3e867b64-064d-4ae5-91a4-7377b05e9394','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"68e7a2ee-d91e-4911-b3d2-f2129e3092da","role":"authenticated"}',true);
insert into cnt select 'new','68e7a2ee-d91e-4911-b3d2-f2129e3092da','persons',count(*) from persons;
insert into cnt select 'new','68e7a2ee-d91e-4911-b3d2-f2129e3092da','families',count(*) from families;
insert into cnt select 'new','68e7a2ee-d91e-4911-b3d2-f2129e3092da','branches',count(*) from branches;
insert into cnt select 'new','68e7a2ee-d91e-4911-b3d2-f2129e3092da','clan_members',count(*) from clan_members;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into cnt select 'new','00000000-0000-4000-8000-000000000001','persons',count(*) from persons;
insert into cnt select 'new','00000000-0000-4000-8000-000000000001','families',count(*) from families;
insert into cnt select 'new','00000000-0000-4000-8000-000000000001','branches',count(*) from branches;
insert into cnt select 'new','00000000-0000-4000-8000-000000000001','clan_members',count(*) from clan_members;
reset role;
set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
insert into cnt select 'new','anon','persons',count(*) from persons;
insert into cnt select 'new','anon','families',count(*) from families;
insert into cnt select 'new','anon','branches',count(*) from branches;
insert into cnt select 'new','anon','clan_members',count(*) from clan_members;
reset role;

select (count(*)>0) as hasdiff from (select o.uid,o.tbl from cnt o join cnt n on o.uid=n.uid and o.tbl=n.tbl and o.phase='old' and n.phase='new' where o.n<>n.n) d \gset
select count(*) as compared from cnt where phase='new';
\if :hasdiff
  \echo 'KHAC NHAU -> rollback'
  rollback;
\else
  \echo 'GIONG HET -> commit'
  commit;
\endif
