\set ON_ERROR_STOP on
begin;
\i /tmp/migration_audit_30d.sql
-- dọn ngay: log cũ hơn 30 ngày + toàn bộ log của dòng họ lịch sử (do script nhập sinh ra)
select count(*) as audit_truoc from public.audit_log \gset
delete from public.audit_log where clan_id in (select id from public.clans where kind = 'historical');
select public.prune_audit_log() as da_xoa_cu;

-- TEST 1: service_role sửa người của dòng họ lịch sử → KHÔNG sinh log
savepoint t1;
select count(*) as a1 from public.audit_log \gset
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update public.persons set bio = coalesce(bio,'') || ' ' where id = (select id from public.persons where clan_id = (select id from public.clans where kind='historical' limit 1) limit 1);
reset role;
select count(*) as a2 from public.audit_log \gset
rollback to savepoint t1;

-- TEST 2: admin (authenticated) sửa người của dòng họ lịch sử → VẪN ghi log
savepoint t2;
select count(*) as b1 from public.audit_log \gset
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
update public.persons set bio = coalesce(bio,'') || ' ' where id = (select id from public.persons where clan_id = (select id from public.clans where kind='historical' limit 1) limit 1);
reset role;
select count(*) as b2 from public.audit_log \gset
rollback to savepoint t2;

select (:a2 = :a1 and :b2 > :b1) as ok \gset
select :a1 as service_truoc, :a2 as service_sau, :b1 as admin_truoc, :b2 as admin_sau;
\if :ok
  \echo 'KIEM TRA DAT -> commit'
  commit;
  insert into supabase_migrations.schema_migrations(version,name) values ('20261101140000','audit_log_retention_30d') on conflict do nothing;
\else
  \echo 'KIEM TRA KHONG DAT -> rollback'
  rollback;
\endif
select count(*) as audit_sau from public.audit_log;
select jobid, schedule, command from cron.job where jobid = 2;
