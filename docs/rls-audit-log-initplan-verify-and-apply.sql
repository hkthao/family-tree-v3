begin;
create temp table cnt(phase text, uid text, tbl text, n bigint);
grant all on cnt to authenticated;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
insert into cnt select 'old','03034d18-8866-4246-a027-6b5bffc55fa9','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"205e4a8b-fa00-4d5f-a34c-a99c5b5573ef","role":"authenticated"}',true);
insert into cnt select 'old','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"3e867b64-064d-4ae5-91a4-7377b05e9394","role":"authenticated"}',true);
insert into cnt select 'old','3e867b64-064d-4ae5-91a4-7377b05e9394','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"68e7a2ee-d91e-4911-b3d2-f2129e3092da","role":"authenticated"}',true);
insert into cnt select 'old','68e7a2ee-d91e-4911-b3d2-f2129e3092da','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into cnt select 'old','00000000-0000-4000-8000-000000000001','audit_log',count(*) from audit_log;
reset role;
-- Cùng cách tối ưu như 20261101120000 cho audit_log: bảng lớn nhất (hàng chục nghìn dòng) và bị
-- bảng điều khiển "Hoạt động gần đây" truy vấn liên tục (kèm đếm toàn bộ dòng của dòng họ), nên gọi
-- is_clan_member() cho từng dòng làm nghẽn máy 1 CPU (19 truy vấn song song mỗi cái ~7 giây).
-- Ngữ nghĩa giữ nguyên: thành viên (không bị khoá) của clan hoặc platform admin.
alter policy audit_log_member_select on public.audit_log
  using ((select public.is_platform_admin()) or clan_id in (select public.my_clan_ids()));

set local role authenticated; select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
insert into cnt select 'new','03034d18-8866-4246-a027-6b5bffc55fa9','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"205e4a8b-fa00-4d5f-a34c-a99c5b5573ef","role":"authenticated"}',true);
insert into cnt select 'new','205e4a8b-fa00-4d5f-a34c-a99c5b5573ef','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"3e867b64-064d-4ae5-91a4-7377b05e9394","role":"authenticated"}',true);
insert into cnt select 'new','3e867b64-064d-4ae5-91a4-7377b05e9394','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"68e7a2ee-d91e-4911-b3d2-f2129e3092da","role":"authenticated"}',true);
insert into cnt select 'new','68e7a2ee-d91e-4911-b3d2-f2129e3092da','audit_log',count(*) from audit_log;
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into cnt select 'new','00000000-0000-4000-8000-000000000001','audit_log',count(*) from audit_log;
reset role;

select (count(*)>0) as hasdiff from (select o.uid from cnt o join cnt n on o.uid=n.uid and o.tbl=n.tbl and o.phase='old' and n.phase='new' where o.n<>n.n) d \gset
select count(*) as compared from cnt where phase='new';
\if :hasdiff
  \echo 'KHAC NHAU -> rollback'
  rollback;
\else
  \echo 'GIONG HET -> commit'
  commit;
  insert into supabase_migrations.schema_migrations(version,name) values ('20261101130000','rls_audit_log_initplan') on conflict do nothing;
\endif
